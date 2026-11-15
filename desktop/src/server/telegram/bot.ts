// Arranque del bot de Telegram para el chat operativo (HU-10, HU-11).
// Sin dependencias nuevas: se habla con la API de Telegram por HTTP (fetch) y long polling.
// El token y los chats autorizados vienen de .env. Si no hay token, el bot no arranca
// y la app de escritorio sigue funcionando igual.
// La lógica de conversación vive en ManejadorChat; aquí solo está el transporte.
// Los avisos (arrancó, no hay token, error de red) van a un Registro: en la app instalada se
// escriben en telegram.log, junto a playa.db, porque no hay consola.

import type { BaseDeDatos } from '../db/connection'
import { ENV_TELEGRAM_CHATS, ENV_TELEGRAM_TOKEN } from '../../shared/config'
import { parsearChatsAutorizados } from './logica'
import { ManejadorChat, type RespuestaChat } from './manejador'
import { registroConsola, type Registro } from '../registro'

const API = 'https://api.telegram.org'

interface Update {
  update_id: number
  message?: { chat?: { id?: number }; text?: string; from?: { first_name?: string; last_name?: string } }
}

interface MensajeEntrante {
  chatId: number
  texto: string
  usuario: string
}

export interface Bot {
  detener(): void
}

/** Llama a un método de la API de Telegram. Devuelve el campo `result` o lanza si Telegram responde error. */
async function llamar<T>(token: string, metodo: string, cuerpo: unknown, signal?: AbortSignal): Promise<T> {
  const r = await fetch(`${API}/bot${token}/${metodo}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
    signal
  })
  const datos = (await r.json()) as { ok: boolean; result?: T; description?: string }
  if (!datos.ok) throw new Error(`Telegram ${metodo}: ${datos.description ?? r.status}`)
  return datos.result as T
}

/** Tiempo máximo de una llamada a Telegram. getUpdates espera hasta 25 s del lado de Telegram. */
const ESPERA_ENVIO_MS = 15_000
const ESPERA_SONDEO_MS = 40_000

/**
 * Ejecuta `fn` y, si falla (red caída, timeout, error de Telegram), la reintenta tras una pausa.
 * Antes, una falla al enviar se perdía en silencio: la conversación ya había avanzado de estado
 * pero el operario no veía la respuesta (p. ej. «Vamos a registrar una venta…»).
 */
export async function conReintentos<T>(
  fn: () => Promise<T>,
  pausasMs: readonly number[] = [1000, 3000],
  dormir: (ms: number) => Promise<void> = (ms) => new Promise((res) => setTimeout(res, ms)),
  avisar: (mensaje: string, detalle: unknown) => void = registroConsola.aviso
): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn()
    } catch (e) {
      if (i >= pausasMs.length) throw e
      avisar(`Falló una llamada a Telegram; reintento ${i + 1} de ${pausasMs.length}`, e)
      await dormir(pausasMs[i])
    }
  }
}

async function enviar(token: string, chatId: number, r: RespuestaChat, registro: Registro): Promise<void> {
  await conReintentos(
    () =>
      llamar(
        token,
        'sendMessage',
        { chat_id: chatId, text: r.texto, reply_markup: r.teclado ?? { remove_keyboard: true } },
        AbortSignal.timeout(ESPERA_ENVIO_MS)
      ),
    undefined,
    undefined,
    registro.aviso
  )
}

function aMensajeEntrante(u: Update): MensajeEntrante | null {
  const chatId = u.message?.chat?.id
  const texto = u.message?.text
  if (typeof chatId !== 'number' || typeof texto !== 'string') return null
  const nombre = [u.message?.from?.first_name, u.message?.from?.last_name].filter(Boolean).join(' ').trim()
  return { chatId, texto, usuario: nombre || 'Operario' }
}

/**
 * Inicia el bot si hay token en el entorno. Devuelve un Bot para detenerlo (o null si no hay token).
 * `env` por defecto es process.env y `registro` la consola; se inyectan en pruebas y en la app.
 */
export function iniciarBot(
  db: BaseDeDatos,
  env: NodeJS.ProcessEnv = process.env,
  registro: Registro = registroConsola
): Bot | null {
  const token = env[ENV_TELEGRAM_TOKEN]?.trim()
  if (!token) {
    registro.aviso(`No se encontró ${ENV_TELEGRAM_TOKEN} en el .env; el chat operativo no se inicia.`)
    return null
  }
  const autorizados = parsearChatsAutorizados(env[ENV_TELEGRAM_CHATS])
  if (autorizados.length === 0) {
    registro.aviso(`${ENV_TELEGRAM_CHATS} está vacío: nadie podrá usar el chat hasta agregar su chat ID.`)
  }

  const manejador = new ManejadorChat(db, autorizados)
  const control = new AbortController()
  let offset = 0
  let vivo = true
  // Solo se registra el primer error de una racha y la recuperación: sin red, el sondeo reintenta
  // cada 3 s y llenaría el log.
  let sinConexion = false

  async function bucle(): Promise<void> {
    while (vivo) {
      try {
        const updates = await llamar<Update[]>(
          token!,
          'getUpdates',
          { offset, timeout: 25, allowed_updates: ['message'] },
          // Si la conexión se cae sin aviso, el sondeo no se queda colgado para siempre.
          AbortSignal.any([control.signal, AbortSignal.timeout(ESPERA_SONDEO_MS)])
        )
        if (sinConexion) {
          sinConexion = false
          registro.info('Se recuperó la conexión con Telegram.')
        }
        for (const u of updates) {
          offset = u.update_id + 1
          const m = aMensajeEntrante(u)
          if (!m) continue
          try {
            for (const respuesta of manejador.procesar(m.chatId, m.texto, m.usuario)) {
              await enviar(token!, m.chatId, respuesta, registro)
            }
          } catch (e) {
            registro.error(`No se pudo procesar o responder «${m.texto}»`, e)
          }
        }
      } catch (e) {
        if (control.signal.aborted) break
        if (!sinConexion) {
          sinConexion = true
          registro.error('Error de red con Telegram; se reintenta cada 3 s hasta recuperar la conexión', e)
        }
        await new Promise((res) => setTimeout(res, 3000))
      }
    }
  }

  void bucle()
  registro.info(`Chat operativo iniciado (${autorizados.length} chat(s) autorizado(s)).`)
  return {
    detener(): void {
      vivo = false
      control.abort()
    }
  }
}
