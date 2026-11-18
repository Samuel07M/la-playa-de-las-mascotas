// Textos del chat de Telegram (canal de los operarios Alirio y Olga).
// Textos en español sencillo, aprobados por el equipo (HU-10).

export const SALUDO =
  '¡Hola! Soy el chat de La Playa de las Mascotas.\n\n' +
  'Desde aquí registras los movimientos de la tienda. ¿Qué quieres hacer?'

/** Texto de los botones del teclado. Son también lo que el operario "envía" al tocarlos. */
export const BOTON_VENTA = 'Registrar venta'
export const BOTON_ENTRADA = 'Registrar entrada'
export const BOTON_BAJA = 'Registrar baja'
export const BOTON_CONSULTA = 'Consultar precio y stock'

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

/** Cierre de todo mensaje no entendido: el bot no avanza hasta recibir un mensaje válido. */
const REESCRIBIR = 'Escríbelo de nuevo o toca «Cancelar».'

/**
 * El mensaje de la venta no sigue el formato: el bot lo dice y pide reescribirlo (no se guarda ni
 * se avisa a la administradora; cambio de HU-15 del 14/11/2026).
 */
export const VENTA_NO_ENTENDIDA = 'No entendí el mensaje.\n\n' + VENTA_COMO_ESCRIBIR + '\n\n' + REESCRIBIR

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

/** Mensaje de entrada o baja que no sigue el formato: se pide reescribirlo. */
export const MOVIMIENTO_NO_ENTENDIDO = 'No entendí el mensaje.\n\n' + COMO_ESCRIBIR_PRODUCTOS + '\n\n' + REESCRIBIR

/**
 * El mensaje sigue el formato pero hay productos que no se reconocen o que coinciden con varios:
 * se dice cuáles y se pide reescribirlo.
 */
export function productosNoEntendidos(noReconocidos: string[], ambiguos: string[], venta: boolean): string {
  const lista = (xs: string[]) => xs.map((x) => `«${x}»`).join(', ')
  const partes: string[] = []
  if (noReconocidos.length) partes.push(`No reconozco: ${lista(noReconocidos)}.`)
  if (ambiguos.length) partes.push(`Hay varios productos que coinciden con ${lista(ambiguos)}: escribe el nombre más completo.`)
  return [partes.join('\n'), venta ? VENTA_COMO_ESCRIBIR : COMO_ESCRIBIR_PRODUCTOS, REESCRIBIR].join('\n\n')
}

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

// ---- HU-13: consultar precio y stock por mensaje (solo lectura) ----

/** Pide el producto a consultar (al tocar «Consultar precio y stock»). */
export const CONSULTA_PEDIR =
  'Escribe el nombre o el alias del producto que quieres consultar.\n' + 'Por ejemplo: «dog chow».'

export const CONSULTA_CANCELADA = 'Consulta cancelada.'

/** Respuesta de la consulta: precio vigente (criterio 1) y stock actual (criterio 2). */
export const consultaResultado = (producto: string, precio: string, stock: number): string =>
  `${producto}\n\nPrecio: ${precio}\nQuedan: ${stock} ${stock === 1 ? 'unidad' : 'unidades'}.`

/** Varios productos contienen el texto: se ofrecen como botones. */
export const consultaVarios = (texto: string): string =>
  `Hay varios productos que coinciden con «${texto}». Toca el que buscas o escribe el nombre más completo.`

/** No se encontró el producto: se sugieren opciones parecidas con botones (criterio 3). */
export const consultaParecidos = (texto: string): string =>
  `No encontré «${texto}». ¿Buscabas alguno de estos? Toca uno o escribe el nombre de nuevo.`

/** No se encontró nada ni parecido. */
export const consultaSinResultados = (texto: string): string =>
  `No encontré «${texto}» ni productos parecidos. Escribe el nombre de nuevo o toca «Cancelar».`

/** La baja supera el stock: se rechaza, no se registra (punto 4 acordado). */
export const bajaRechazada = (producto: string, stock: number): string =>
  `No se puede dar de baja «${producto}»: la cantidad supera el stock actual (${stock}). No se registró ninguna baja.`
