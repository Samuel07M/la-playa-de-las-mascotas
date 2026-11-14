// Lógica pura del bot (sin red): se prueba con Vitest sin llamar a Telegram.
// HU-10: acceder al chat, con botones específicos, texto legible y sin acceso a lo de Isabel.

import { BOTON_BAJA, BOTON_ENTRADA, BOTON_VENTA } from './textos'

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

/** Criterio 3 (HU-10): solo los chats autorizados (Alirio y Olga) usan el chat; el resto se ignora. */
export function estaAutorizado(chatId: number, autorizados: readonly number[]): boolean {
  return autorizados.includes(chatId)
}

/** Lee los chats autorizados desde el valor de TELEGRAM_CHATS_AUTORIZADOS ("111,222"). */
export function parsearChatsAutorizados(valor: string | undefined): number[] {
  if (!valor) return []
  return valor
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n !== 0)
}
