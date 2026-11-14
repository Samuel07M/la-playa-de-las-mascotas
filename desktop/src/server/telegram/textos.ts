// Textos del chat de Telegram (canal de los operarios Alirio y Olga).
// La restricción del mockup aplica solo a la app de escritorio; aquí los textos son propios,
// en español sencillo y aprobados por el equipo (HU-10).

export const SALUDO =
  '¡Hola! Soy el chat de La Playa de las Mascotas.\n\n' +
  'Desde aquí registras los movimientos de la tienda sin usar la libreta. ¿Qué quieres hacer?'

/** Texto de los botones del teclado. Son también lo que el operario "envía" al tocarlos. */
export const BOTON_VENTA = 'Registrar venta'
export const BOTON_ENTRADA = 'Registrar entrada'
export const BOTON_BAJA = 'Registrar baja'

/** Mensaje para quien no está autorizado (criterio 3: solo el chat, no las funciones de Isabel). */
export const NO_AUTORIZADO =
  'Este chat es solo para el personal de La Playa de las Mascotas. ' +
  'Si eres del equipo, pídele a la administradora que te dé acceso.'

/** Respuesta provisional al tocar un botón de acción. El registro llega en las HU-11 a HU-13. */
export const ACCION_PROXIMAMENTE =
  'Muy pronto podrás registrar esto escribiendo un mensaje corto. Por ahora el chat ya quedó listo.'
