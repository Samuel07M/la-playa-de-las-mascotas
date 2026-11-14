// Máquina de conversación del chat por cada chat de Telegram (HU-11 venta, HU-12 entrada y baja).
// Es lógica pura: recibe el estado actual + el texto del operario y devuelve el nuevo estado,
// los mensajes a enviar y, cuando corresponde, un "efecto" que el bot ejecuta contra la base de
// datos (interpretar productos o registrar el movimiento). Así todo el flujo se prueba sin red ni BD.

import type { MetodoPago, MotivoBaja } from '../../shared/constantes'
import type { Teclado } from './logica'
import { tecladoPrincipal } from './logica'
import type { LineaResuelta } from './ventas'
import {
  BAJA_CANCELADA,
  BAJA_CONFIRMAR,
  BAJA_PEDIR,
  BAJA_PEDIR_MOTIVO,
  BOTON_BAJA,
  BOTON_CANCELAR,
  BOTON_CONFIRMAR,
  BOTON_DANADO,
  BOTON_DIGITAL,
  BOTON_EFECTIVO,
  BOTON_ENTRADA,
  BOTON_OTRO,
  BOTON_VENCIDO,
  BOTON_VENTA,
  ENTRADA_CANCELADA,
  ENTRADA_CONFIRMAR,
  ENTRADA_PEDIR,
  ENTRADA_PEDIR_REFERENCIA,
  ENTRADA_REFERENCIA_VACIA,
  SALUDO,
  VENTA_CANCELADA,
  VENTA_PEDIR,
  VENTA_PEDIR_PAGO,
  VENTA_SIN_CONVERSACION
} from './textos'

/** Operación que se está registrando por el chat. */
export type Operacion = 'venta' | 'entrada' | 'baja'

/** Estado de la conversación de un chat. */
export type Estado =
  | { tipo: 'inactivo' }
  /** Pidió registrar algo; espera el mensaje con los productos. */
  | { tipo: 'esperando_productos'; operacion: Operacion }
  /** Venta: se mostró el resumen; espera el método de pago. */
  | { tipo: 'esperando_pago'; lineas: LineaResuelta[] }
  /** Entrada: se mostró el resumen; espera la referencia escrita. */
  | { tipo: 'esperando_referencia'; lineas: LineaResuelta[] }
  /** Baja: se mostró el resumen; espera el motivo (botones). */
  | { tipo: 'esperando_motivo'; lineas: LineaResuelta[] }
  /** Venta lista; espera Confirmar/Cancelar (con o sin aviso de sobre-stock). */
  | { tipo: 'confirmar_venta'; lineas: LineaResuelta[]; metodoPago: MetodoPago; confirmarSobreStock: boolean }
  /** Entrada lista; espera Confirmar/Cancelar. */
  | { tipo: 'confirmar_entrada'; lineas: LineaResuelta[]; referencia: string }
  /** Baja lista; espera Confirmar/Cancelar. */
  | { tipo: 'confirmar_baja'; lineas: LineaResuelta[]; motivo: MotivoBaja }

/** Mensaje que el bot debe enviar. */
export interface Salida {
  texto: string
  teclado?: Teclado
}

/**
 * Efecto que el bot ejecuta contra la BD. La conversación no toca la base de datos directamente:
 * pide el efecto y vuelve a entrar con el resultado.
 */
export type Efecto =
  | { tipo: 'parsear'; operacion: Operacion; texto: string }
  | { tipo: 'registrar_venta'; lineas: LineaResuelta[]; metodoPago: MetodoPago; confirmarSobreStock: boolean }
  | { tipo: 'registrar_entrada'; lineas: LineaResuelta[]; referencia: string }
  | { tipo: 'registrar_baja'; lineas: LineaResuelta[]; motivo: MotivoBaja }

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
const tecladoMotivo = (): Teclado => teclado([BOTON_VENCIDO, BOTON_DANADO, BOTON_OTRO], [BOTON_CANCELAR])
const tecladoConfirmar = (): Teclado => teclado([BOTON_CONFIRMAR], [BOTON_CANCELAR])
/** Al pedir texto libre (productos o referencia) solo tiene sentido poder cancelar. */
const tecladoCancelar = (): Teclado => teclado([BOTON_CANCELAR])

const metodoDe = (texto: string): MetodoPago | null =>
  texto === BOTON_EFECTIVO ? 'efectivo' : texto === BOTON_DIGITAL ? 'digital' : null

const motivoDe = (texto: string): MotivoBaja | null =>
  texto === BOTON_VENCIDO ? 'vencido' : texto === BOTON_DANADO ? 'dañado' : texto === BOTON_OTRO ? 'otro' : null

/** Comandos de bienvenida: /start, texto vacío o un saludo simple (no es un intento de registro). */
function esSaludo(t: string): boolean {
  if (t === '') return true
  if (t.startsWith('/')) return true
  return /^(hola|buenas|hey|menu|menú|inicio)$/i.test(t)
}

const cancelada = (operacion: Operacion): string =>
  operacion === 'venta' ? VENTA_CANCELADA : operacion === 'entrada' ? ENTRADA_CANCELADA : BAJA_CANCELADA

/** Operación de un estado en curso (para el mensaje de cancelación). */
function operacionDe(estado: Estado): Operacion {
  switch (estado.tipo) {
    case 'esperando_productos':
      return estado.operacion
    case 'esperando_pago':
    case 'confirmar_venta':
      return 'venta'
    case 'esperando_referencia':
    case 'confirmar_entrada':
      return 'entrada'
    case 'esperando_motivo':
    case 'confirmar_baja':
      return 'baja'
    default:
      return 'venta'
  }
}

export function avanzar(estado: Estado, texto: string): Transicion {
  const t = texto.trim()

  // Cancelar en cualquier punto de una operación en curso (el stock no se modifica).
  if (t === BOTON_CANCELAR && estado.tipo !== 'inactivo') {
    return { estado: { tipo: 'inactivo' }, salidas: [{ texto: cancelada(operacionDe(estado)), teclado: tecladoPrincipal() }] }
  }

  switch (estado.tipo) {
    case 'inactivo': {
      if (t === BOTON_VENTA) {
        return { estado: { tipo: 'esperando_productos', operacion: 'venta' }, salidas: [{ texto: VENTA_PEDIR, teclado: tecladoCancelar() }] }
      }
      if (t === BOTON_ENTRADA) {
        return { estado: { tipo: 'esperando_productos', operacion: 'entrada' }, salidas: [{ texto: ENTRADA_PEDIR, teclado: tecladoCancelar() }] }
      }
      if (t === BOTON_BAJA) {
        return { estado: { tipo: 'esperando_productos', operacion: 'baja' }, salidas: [{ texto: BAJA_PEDIR, teclado: tecladoCancelar() }] }
      }
      // /start, "hola" o vacío: saludo con botones (HU-10).
      if (esSaludo(t)) {
        return { estado, salidas: [{ texto: SALUDO, teclado: tecladoPrincipal() }] }
      }
      // Cualquier otro texto se interpreta como un intento de venta (HU-11: «2 concentrado y 1 collar»).
      return { estado, salidas: [], efecto: { tipo: 'parsear', operacion: 'venta', texto: t } }
    }

    case 'esperando_productos': {
      // El texto se interpreta fuera (necesita la BD): se pide el efecto y el bot vuelve con recibirLineas.
      return { estado, salidas: [], efecto: { tipo: 'parsear', operacion: estado.operacion, texto: t } }
    }

    case 'esperando_pago': {
      const metodo = metodoDe(t)
      if (!metodo) return { estado, salidas: [{ texto: VENTA_PEDIR_PAGO, teclado: tecladoPago() }] }
      return {
        estado: { tipo: 'confirmar_venta', lineas: estado.lineas, metodoPago: metodo, confirmarSobreStock: false },
        salidas: [{ texto: '¿Confirmas la venta?', teclado: tecladoConfirmar() }]
      }
    }

    case 'esperando_referencia': {
      if (t === '') return { estado, salidas: [{ texto: ENTRADA_REFERENCIA_VACIA, teclado: tecladoCancelar() }] }
      return {
        estado: { tipo: 'confirmar_entrada', lineas: estado.lineas, referencia: t },
        salidas: [{ texto: `Referencia: ${t}`, teclado: undefined }, { texto: ENTRADA_CONFIRMAR, teclado: tecladoConfirmar() }]
      }
    }

    case 'esperando_motivo': {
      const motivo = motivoDe(t)
      if (!motivo) return { estado, salidas: [{ texto: BAJA_PEDIR_MOTIVO, teclado: tecladoMotivo() }] }
      return {
        estado: { tipo: 'confirmar_baja', lineas: estado.lineas, motivo },
        salidas: [{ texto: BAJA_CONFIRMAR, teclado: tecladoConfirmar() }]
      }
    }

    case 'confirmar_venta': {
      if (t === BOTON_CONFIRMAR) {
        return {
          estado,
          salidas: [],
          efecto: { tipo: 'registrar_venta', lineas: estado.lineas, metodoPago: estado.metodoPago, confirmarSobreStock: estado.confirmarSobreStock }
        }
      }
      return { estado, salidas: [{ texto: '¿Confirmas la venta?', teclado: tecladoConfirmar() }] }
    }

    case 'confirmar_entrada': {
      if (t === BOTON_CONFIRMAR) {
        return { estado, salidas: [], efecto: { tipo: 'registrar_entrada', lineas: estado.lineas, referencia: estado.referencia } }
      }
      return { estado, salidas: [{ texto: ENTRADA_CONFIRMAR, teclado: tecladoConfirmar() }] }
    }

    case 'confirmar_baja': {
      if (t === BOTON_CONFIRMAR) {
        return { estado, salidas: [], efecto: { tipo: 'registrar_baja', lineas: estado.lineas, motivo: estado.motivo } }
      }
      return { estado, salidas: [{ texto: BAJA_CONFIRMAR, teclado: tecladoConfirmar() }] }
    }
  }
}

/** Venta: el bot resolvió los productos → muestra el resumen y pide el método de pago. */
export function ventaRecibirLineas(lineas: LineaResuelta[], resumen: string): Transicion {
  return { estado: { tipo: 'esperando_pago', lineas }, salidas: [{ texto: resumen }, { texto: VENTA_PEDIR_PAGO, teclado: tecladoPago() }] }
}

/** Entrada: el bot resolvió los productos → muestra el resumen y pide la referencia. */
export function entradaRecibirLineas(lineas: LineaResuelta[], resumen: string): Transicion {
  return { estado: { tipo: 'esperando_referencia', lineas }, salidas: [{ texto: resumen }, { texto: ENTRADA_PEDIR_REFERENCIA, teclado: tecladoCancelar() }] }
}

/** Baja: el bot resolvió los productos → muestra el resumen y pide el motivo (criterio 2). */
export function bajaRecibirLineas(lineas: LineaResuelta[], resumen: string): Transicion {
  return { estado: { tipo: 'esperando_motivo', lineas }, salidas: [{ texto: resumen }, { texto: BAJA_PEDIR_MOTIVO, teclado: tecladoMotivo() }] }
}

/** El mensaje no se entendió o tiene productos no reconocidos: vuelve a inactivo (ya se guardó como pendiente). */
export function noEntendido(aviso: string): Transicion {
  return { estado: { tipo: 'inactivo' }, salidas: [{ texto: aviso, teclado: tecladoPrincipal() }] }
}

/** La venta superó el stock: se advierte y se pide una segunda confirmación (regla de negocio HU-03). */
export function pedirConfirmacionSobreStock(
  estado: Extract<Estado, { tipo: 'confirmar_venta' }>,
  aviso: string
): Transicion {
  return { estado: { ...estado, confirmarSobreStock: true }, salidas: [{ texto: aviso, teclado: tecladoConfirmar() }] }
}

/** El movimiento quedó registrado: vuelve a inactivo y confirma al operario. */
export function registrado(mensajeExito: string): Transicion {
  return { estado: { tipo: 'inactivo' }, salidas: [{ texto: mensajeExito, teclado: tecladoPrincipal() }] }
}

export { tecladoPago, tecladoMotivo, tecladoConfirmar }
export { VENTA_SIN_CONVERSACION }
