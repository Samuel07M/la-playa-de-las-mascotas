// Lógica pura del bot (sin red): se prueba con Vitest sin llamar a Telegram.
// HU-10: acceder al chat, con botones específicos, texto legible y sin acceso a lo de Isabel.

import {
  ACCION_PROXIMAMENTE,
  BOTON_BAJA,
  BOTON_ENTRADA,
  BOTON_VENTA,
  NO_AUTORIZADO,
  SALUDO
} from './textos'

/** Teclado de botones grandes del chat (criterio 2: botones específicos, uno por fila para que se lean bien). */
export interface Teclado {
  keyboard: { text: string }[][]
  resize_keyboard: true
  is_persistent: true
}

export function tecladoPrincipal(): Teclado {
  return {
    keyboard: [[{ text: BOTON_VENTA }], [{ text: BOTON_ENTRADA }], [{ text: BOTON_BAJA }]],
    resize_keyboard: true,
    is_persistent: true
  }
}

/** Parte mínima de una actualización de Telegram que usamos (getUpdates → update.message). */
export interface MensajeEntrante {
  chatId: number
  texto: string
}

/** Lo que el bot debe responder: a qué chat, con qué texto y si muestra el teclado. */
export interface RespuestaBot {
  chatId: number
  texto: string
  teclado?: Teclado
}

/** Criterio 3: solo responden los chats autorizados (Alirio y Olga). El resto se ignora con aviso. */
export function estaAutorizado(chatId: number, autorizados: readonly number[]): boolean {
  return autorizados.includes(chatId)
}

/**
 * Decide la respuesta del bot a un mensaje entrante. Función pura.
 * - Chat no autorizado → aviso, sin teclado (criterio 3).
 * - /start o cualquier texto → saludo + teclado de botones (criterios 1 y 2).
 * - Botones de acción → aviso de "próximamente" (el registro es de HU-11 a HU-13).
 */
export function decidirRespuesta(m: MensajeEntrante, autorizados: readonly number[]): RespuestaBot {
  if (!estaAutorizado(m.chatId, autorizados)) {
    return { chatId: m.chatId, texto: NO_AUTORIZADO }
  }
  const texto = m.texto.trim()
  if (texto === BOTON_VENTA || texto === BOTON_ENTRADA || texto === BOTON_BAJA) {
    return { chatId: m.chatId, texto: ACCION_PROXIMAMENTE, teclado: tecladoPrincipal() }
  }
  // /start, "hola", o cualquier otra cosa: se da la bienvenida y se muestran los botones.
  return { chatId: m.chatId, texto: SALUDO, teclado: tecladoPrincipal() }
}

/** Lee los chats autorizados desde el valor de TELEGRAM_CHATS_AUTORIZADOS ("111,222"). */
export function parsearChatsAutorizados(valor: string | undefined): number[] {
  if (!valor) return []
  return valor
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n !== 0)
}
