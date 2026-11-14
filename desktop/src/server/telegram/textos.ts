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

/** Confirmación tras registrar la venta (criterio 2). */
export const ventaExito = (consecutivo: string, total: string): string =>
  `✅ Venta ${consecutivo} registrada. Total: ${total}. El stock ya quedó descontado.`

// ---- HU-12: registrar entradas y bajas por mensaje ----

const COMO_ESCRIBIR_PRODUCTOS =
  'Escribe la cantidad y luego el producto, separando con «y» o comas.\n' +
  'Por ejemplo: «3 dog chow y 2 arena».'

/** Pide los productos de la entrada (al tocar «Registrar entrada»). */
export const ENTRADA_PEDIR = 'Vamos a registrar una entrada de mercancía.\n\n' + COMO_ESCRIBIR_PRODUCTOS

/** Pide los productos de la baja (al tocar «Registrar baja»). */
export const BAJA_PEDIR = 'Vamos a registrar una baja de mercancía.\n\n' + COMO_ESCRIBIR_PRODUCTOS

/** Tras los productos de una entrada, se pide la referencia (punto 1 acordado: opción a). */
export const ENTRADA_PEDIR_REFERENCIA =
  '¿Cuál es la referencia de la factura o remisión? Escríbela (por ejemplo: «FAC-1023»).'

export const ENTRADA_REFERENCIA_VACIA = 'La referencia no puede estar vacía. Escríbela de nuevo.'

/** Motivo de la baja, con botones (criterio 2). */
export const BOTON_VENCIDO = 'Vencido'
export const BOTON_DANADO = 'Dañado'
export const BOTON_OTRO = 'Otro'
export const BAJA_PEDIR_MOTIVO = '¿Por qué das de baja estos productos?'

/** Mensaje no entendido para entrada o baja: se guarda para que Isabel lo revise (punto 5). */
export const MOVIMIENTO_NO_ENTENDIDO =
  'No entendí bien el mensaje, así que lo guardé para que la administradora lo revise.\n\n' +
  COMO_ESCRIBIR_PRODUCTOS

export const ENTRADA_CANCELADA = 'Entrada cancelada. No se modificó el stock.'
export const BAJA_CANCELADA = 'Baja cancelada. No se modificó el stock.'

export const ENTRADA_CONFIRMAR = '¿Confirmas la entrada?'
export const BAJA_CONFIRMAR = '¿Confirmas la baja?'

/** Confirmación tras registrar una entrada (criterio 3). */
export const entradaExito = (referencia: string, productos: number): string =>
  `✅ Entrada registrada con referencia ${referencia} (${productos} producto(s)). El stock ya quedó actualizado.`

/** Confirmación tras registrar una baja (criterio 3). */
export const bajaExito = (productos: number): string =>
  `✅ Baja registrada (${productos} producto(s)). El stock ya quedó actualizado.`

/** La baja supera el stock: se rechaza, no se registra (punto 4 acordado). */
export const bajaRechazada = (producto: string, stock: number): string =>
  `No se puede dar de baja «${producto}»: la cantidad supera el stock actual (${stock}). No se registró ninguna baja.`
