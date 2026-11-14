// Máquina de conversación del chat por cada chat de Telegram (HU-11).
// Es lógica pura: recibe el estado actual + el texto del operario y devuelve el nuevo estado,
// los mensajes a enviar y, cuando corresponde, un "efecto" que el bot ejecuta contra la base de
// datos (resolver productos o registrar la venta). Así todo el flujo se prueba sin red ni BD.

import type { MetodoPago } from '../../shared/constantes'
import type { Teclado } from './logica'
import { tecladoPrincipal } from './logica'
import type { LineaResuelta } from './ventas'
import {
  ACCION_NO_DISPONIBLE,
  BOTON_BAJA,
  BOTON_CANCELAR,
  BOTON_CONFIRMAR,
  BOTON_DIGITAL,
  BOTON_EFECTIVO,
  BOTON_ENTRADA,
  BOTON_VENTA,
  SALUDO,
  VENTA_CANCELADA,
  VENTA_PEDIR,
  VENTA_PEDIR_PAGO,
  VENTA_SIN_CONVERSACION
} from './textos'

/** Estado de la conversación de un chat. */
export type Estado =
  | { tipo: 'inactivo' }
  /** Pidió registrar una venta; espera el mensaje con los productos. */
  | { tipo: 'esperando_venta' }
  /** Se mostró el resumen; espera que elija el método de pago. */
  | { tipo: 'esperando_pago'; lineas: LineaResuelta[] }
  /** Eligió pago; espera Confirmar/Cancelar (con o sin aviso de sobre-stock). */
  | { tipo: 'esperando_confirmacion'; lineas: LineaResuelta[]; metodoPago: MetodoPago; confirmarSobreStock: boolean }

/** Mensaje que el bot debe enviar. */
export interface Salida {
  texto: string
  teclado?: Teclado
}

/**
 * Efecto que el bot ejecuta contra la BD. La conversación no toca la base de datos directamente:
 * pide el efecto y, en el caso de "parsear_venta", vuelve a entrar con el resultado.
 */
export type Efecto =
  | { tipo: 'parsear_venta'; texto: string }
  | { tipo: 'registrar_venta'; lineas: LineaResuelta[]; metodoPago: MetodoPago; confirmarSobreStock: boolean }

export interface Transicion {
  estado: Estado
  salidas: Salida[]
  efecto?: Efecto
}

const teclado = (...filas: string[][]): Teclado => ({
  keyboard: filas.map((fila) => fila.map((text) => ({ text }))),
  resize_keyboard: true,
  is_persistent: true
})

const tecladoPago = (): Teclado => teclado([BOTON_EFECTIVO, BOTON_DIGITAL], [BOTON_CANCELAR])
const tecladoConfirmar = (): Teclado => teclado([BOTON_CONFIRMAR], [BOTON_CANCELAR])

const metodoDe = (texto: string): MetodoPago | null =>
  texto === BOTON_EFECTIVO ? 'efectivo' : texto === BOTON_DIGITAL ? 'digital' : null

/** Comandos de bienvenida: /start, texto vacío o un saludo simple (no es un intento de venta). */
function esSaludo(t: string): boolean {
  if (t === '') return true
  if (t.startsWith('/')) return true
  return /^(hola|buenas|hey|menu|menú|inicio)$/i.test(t)
}

/**
 * Avanza la conversación con el texto recibido. Para iniciar una venta por texto libre
 * (sin tocar el botón) el bot pasa el estado 'esperando_venta' tras detectar que no es un comando;
 * aquí se decide a partir del estado actual.
 */
export function avanzar(estado: Estado, texto: string): Transicion {
  const t = texto.trim()

  // Cancelar en cualquier punto de una venta (criterio 3: el stock no se modifica).
  if (t === BOTON_CANCELAR && estado.tipo !== 'inactivo') {
    return { estado: { tipo: 'inactivo' }, salidas: [{ texto: VENTA_CANCELADA, teclado: tecladoPrincipal() }] }
  }

  switch (estado.tipo) {
    case 'inactivo': {
      if (t === BOTON_VENTA) {
        return { estado: { tipo: 'esperando_venta' }, salidas: [{ texto: VENTA_PEDIR, teclado: tecladoPrincipal() }] }
      }
      // Botones de HU-12 y HU-13: aún no implementados. Se reconocen y se avisa, sin tratarlos como venta
      // (si no, una pulsación de botón acabaría como mensaje pendiente para Isabel).
      if (t === BOTON_ENTRADA || t === BOTON_BAJA) {
        return { estado, salidas: [{ texto: ACCION_NO_DISPONIBLE, teclado: tecladoPrincipal() }] }
      }
      // /start, "hola" o vacío: saludo con botones (HU-10).
      if (esSaludo(t)) {
        return { estado, salidas: [{ texto: SALUDO, teclado: tecladoPrincipal() }] }
      }
      // Cualquier otro texto se interpreta como un intento de venta (HU-11: «2 concentrado y 1 collar»).
      // El parseo necesita la BD, así que se pide el efecto y el bot vuelve con recibirLineas/ventaNoEntendida.
      return { estado, salidas: [], efecto: { tipo: 'parsear_venta', texto: t } }
    }

    case 'esperando_venta': {
      if (t === BOTON_VENTA) {
        return { estado, salidas: [{ texto: VENTA_PEDIR, teclado: tecladoPrincipal() }] }
      }
      // El texto se interpreta fuera (necesita la BD): se pide el efecto y el bot vuelve con recibirLineas().
      return { estado, salidas: [], efecto: { tipo: 'parsear_venta', texto: t } }
    }

    case 'esperando_pago': {
      const metodo = metodoDe(t)
      if (!metodo) {
        return { estado, salidas: [{ texto: VENTA_PEDIR_PAGO, teclado: tecladoPago() }] }
      }
      return {
        estado: { tipo: 'esperando_confirmacion', lineas: estado.lineas, metodoPago: metodo, confirmarSobreStock: false },
        salidas: [{ texto: '¿Confirmas la venta?', teclado: tecladoConfirmar() }]
      }
    }

    case 'esperando_confirmacion': {
      if (t === BOTON_CONFIRMAR) {
        return {
          estado,
          salidas: [],
          efecto: {
            tipo: 'registrar_venta',
            lineas: estado.lineas,
            metodoPago: estado.metodoPago,
            confirmarSobreStock: estado.confirmarSobreStock
          }
        }
      }
      return { estado, salidas: [{ texto: '¿Confirmas la venta?', teclado: tecladoConfirmar() }] }
    }
  }
}

/** El bot ya resolvió los productos del mensaje: muestra el resumen y pide el método de pago. */
export function recibirLineas(lineas: LineaResuelta[], resumen: string): Transicion {
  return {
    estado: { tipo: 'esperando_pago', lineas },
    salidas: [{ texto: resumen }, { texto: VENTA_PEDIR_PAGO, teclado: tecladoPago() }]
  }
}

/** El mensaje no se entendió o tiene productos no reconocidos: vuelve a inactivo (ya se guardó como pendiente). */
export function ventaNoEntendida(aviso: string): Transicion {
  return { estado: { tipo: 'inactivo' }, salidas: [{ texto: aviso, teclado: tecladoPrincipal() }] }
}

/**
 * La venta superó el stock y falta la segunda confirmación (criterio/regla de negocio HU-03):
 * se advierte y se queda esperando confirmación, ahora con confirmarSobreStock = true.
 */
export function pedirConfirmacionSobreStock(
  estado: Extract<Estado, { tipo: 'esperando_confirmacion' }>,
  aviso: string
): Transicion {
  return {
    estado: { ...estado, confirmarSobreStock: true },
    salidas: [{ texto: aviso, teclado: tecladoConfirmar() }]
  }
}

/** La venta quedó registrada: vuelve a inactivo y confirma al operario. */
export function ventaRegistrada(mensajeExito: string): Transicion {
  return { estado: { tipo: 'inactivo' }, salidas: [{ texto: mensajeExito, teclado: tecladoPrincipal() }] }
}

/** Reexportes para que el bot arme teclados sin duplicar. */
export { tecladoPago, tecladoConfirmar }
export { VENTA_SIN_CONVERSACION }
