// Arranque del bot de Telegram para el chat operativo (HU-10).
// Sin dependencias nuevas: se habla con la API de Telegram por HTTP (fetch) y long polling.
// El token y los chats autorizados vienen de .env (ver cargarEnv). Si no hay token, el bot no arranca
// y la app de escritorio sigue funcionando igual.

import { ENV_TELEGRAM_CHATS, ENV_TELEGRAM_TOKEN } from '../../shared/config'
import { decidirRespuesta, parsearChatsAutorizados, type MensajeEntrante, type RespuestaBot } from './logica'

const API = 'https://api.telegram.org'

interface Update {
  update_id: number
  message?: { chat?: { id?: number }; text?: string }
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

async function responder(token: string, r: RespuestaBot): Promise<void> {
  await llamar(token, 'sendMessage', {
    chat_id: r.chatId,
    text: r.texto,
    reply_markup: r.teclado ?? { remove_keyboard: true }
  })
}

function aMensajeEntrante(u: Update): MensajeEntrante | null {
  const chatId = u.message?.chat?.id
  const texto = u.message?.text
  if (typeof chatId !== 'number' || typeof texto !== 'string') return null
  return { chatId, texto }
}

/**
 * Inicia el bot si hay token en el entorno. Devuelve un Bot para detenerlo (o null si no hay token).
 * `env` por defecto es process.env; se inyecta en pruebas.
 */
export function iniciarBot(env: NodeJS.ProcessEnv = process.env): Bot | null {
  const token = env[ENV_TELEGRAM_TOKEN]?.trim()
  if (!token) {
    console.warn(`[telegram] No se encontró ${ENV_TELEGRAM_TOKEN}; el chat operativo no se inicia.`)
    return null
  }
  const autorizados = parsearChatsAutorizados(env[ENV_TELEGRAM_CHATS])
  if (autorizados.length === 0) {
    console.warn(
      `[telegram] ${ENV_TELEGRAM_CHATS} está vacío: nadie podrá usar el chat hasta agregar su chat ID.`
    )
  }

  const control = new AbortController()
  let offset = 0
  let vivo = true

  async function bucle(): Promise<void> {
    while (vivo) {
      try {
        const updates = await llamar<Update[]>(
          token!,
          'getUpdates',
          { offset, timeout: 25, allowed_updates: ['message'] },
          control.signal
        )
        for (const u of updates) {
          offset = u.update_id + 1
          const m = aMensajeEntrante(u)
          if (!m) continue
          try {
            await responder(token!, decidirRespuesta(m, autorizados))
          } catch (e) {
            console.error('[telegram] No se pudo responder un mensaje:', e)
          }
        }
      } catch (e) {
        if (control.signal.aborted) break
        console.error('[telegram] Error en el sondeo; se reintenta en 3 s:', e)
        await new Promise((res) => setTimeout(res, 3000))
      }
    }
  }

  void bucle()
  console.log('[telegram] Chat operativo iniciado.')
  return {
    detener(): void {
      vivo = false
      control.abort()
    }
  }
}
