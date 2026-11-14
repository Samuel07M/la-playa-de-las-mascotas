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

// ---- HU-11: registrar venta por mensaje ----

export const VENTA_COMO_ESCRIBIR =
  'Escribe la venta así: la cantidad y luego el producto, separando con «y» o comas.\n' +
  'Por ejemplo: «2 dog chow y 1 collar».'

/** Pide escribir la venta (al tocar el botón «Registrar venta»). */
export const VENTA_PEDIR = 'Vamos a registrar una venta.\n\n' + VENTA_COMO_ESCRIBIR

/** El mensaje no sigue el formato o tiene productos no reconocidos: se guarda para que Isabel lo revise. */
export const VENTA_NO_ENTENDIDA =
  'No entendí bien el mensaje, así que lo guardé para que la administradora lo revise.\n\n' +
  VENTA_COMO_ESCRIBIR

export const BOTON_EFECTIVO = 'Efectivo'
export const BOTON_DIGITAL = 'Digital'
export const BOTON_CONFIRMAR = 'Confirmar'
export const BOTON_CANCELAR = 'Cancelar'

/** Pregunta el método de pago tras mostrar el resumen (punto 2 acordado: opción a). */
export const VENTA_PEDIR_PAGO = '¿Cómo pagó el cliente?'

export const VENTA_CANCELADA = 'Venta cancelada. No se modificó el stock.'

export const VENTA_SIN_CONVERSACION =
  'No hay ninguna venta en curso. Toca «Registrar venta» o escribe la venta para empezar.'

/** Aviso para los botones aún no implementados: Registrar entrada (HU-12) y Registrar baja (HU-13). */
export const ACCION_NO_DISPONIBLE =
  'Esta opción todavía no está disponible. Por ahora puedes registrar ventas con «Registrar venta».'

/** Confirmación tras registrar la venta (criterio 2). */
export const ventaExito = (consecutivo: string, total: string): string =>
  `✅ Venta ${consecutivo} registrada. Total: ${total}. El stock ya quedó descontado.`
