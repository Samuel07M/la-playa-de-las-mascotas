// Orquesta la conversación por cada chat y ejecuta los efectos contra la base de datos.
// Mantiene el estado de cada chat en memoria. Se prueba sin red inyectando el acceso a la BD.
// Autorización (HU-10 criterio 3): solo los chats autorizados avanzan la conversación.

import type { BaseDeDatos } from '../db/connection'
import type { MetodoPago, MotivoBaja } from '../../shared/constantes'
import { money } from '../../shared/formato'
import { M } from '../../shared/esquemas'
import { ErrorApi } from '../errores'
import { faltantesDeStock, registrarVenta } from '../modules/ventas'
import { registrarEntrada } from '../modules/entradas'
import { registrarBaja } from '../modules/bajas'
import { stockDe } from '../modules/movimientos'
import { listarProductos } from '../modules/productos'
import { registrarMensaje } from '../modules/mensajes'
import { estaAutorizado, tecladoPrincipal, type Teclado } from './logica'
import {
  MOVIMIENTO_NO_ENTENDIDO,
  NO_AUTORIZADO,
  VENTA_NO_ENTENDIDA,
  bajaExito,
  bajaRechazada,
  entradaExito,
  ventaExito
} from './textos'
import { parsearVenta, resolverProductos, resumenCantidades, resumenVenta, type LineaResuelta } from './ventas'
import {
  avanzar,
  bajaRecibirLineas,
  entradaRecibirLineas,
  noEntendido,
  registrado,
  ventaRechazada,
  ventaRecibirLineas,
  type Estado,
  type Operacion,
  type Salida,
  type Transicion
} from './conversacion'

export interface RespuestaChat {
  texto: string
  teclado?: Teclado
}

/** Búsqueda de productos del catálogo por texto, con la forma que espera resolverProductos. */
function buscarProductos(db: BaseDeDatos, q: string) {
  return listarProductos(db, { q, activos: true }).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    precioVenta: p.precioVenta,
    activo: p.activo
  }))
}

export class ManejadorChat {
  private estados = new Map<number, Estado>()

  constructor(
    private db: BaseDeDatos,
    private autorizados: readonly number[]
  ) {}

  private estadoDe(chatId: number): Estado {
    return this.estados.get(chatId) ?? { tipo: 'inactivo' }
  }

  /** Guarda el mensaje como "no entendido" para que Isabel lo revise (HU-15 / punto 5 acordado). */
  private guardarPendiente(texto: string, usuario: string): void {
    registrarMensaje(this.db, { texto, usuario, estado: 'no_entendido' })
  }

  procesar(chatId: number, texto: string, usuario: string): RespuestaChat[] {
    if (!estaAutorizado(chatId, this.autorizados)) {
      return [{ texto: NO_AUTORIZADO }]
    }

    let estado = this.estadoDe(chatId)
    let transicion = avanzar(estado, texto)

    while (transicion.efecto) {
      const efecto = transicion.efecto
      switch (efecto.tipo) {
        case 'parsear':
          transicion = this.manejarParseo(efecto.operacion, efecto.texto, usuario)
          break
        case 'registrar_venta':
          transicion = this.registrarVenta(efecto)
          break
        case 'registrar_entrada':
          transicion = this.registrarEntrada(efecto)
          break
        case 'registrar_baja':
          transicion = this.registrarBaja(efecto)
          break
      }
      estado = transicion.estado
    }

    this.estados.set(chatId, transicion.estado)
    return transicion.salidas.map(salidaARespuesta)
  }

  private manejarParseo(operacion: Operacion, texto: string, usuario: string): Transicion {
    const avisoNoEntendido = operacion === 'venta' ? VENTA_NO_ENTENDIDA : MOVIMIENTO_NO_ENTENDIDO
    const parseo = parsearVenta(texto)
    if (!parseo.ok) {
      this.guardarPendiente(texto, usuario)
      return noEntendido(avisoNoEntendido)
    }
    const resuelto = resolverProductos(this.db, parseo.partes, buscarProductos)
    if (!resuelto.ok) {
      this.guardarPendiente(texto, usuario)
      return noEntendido(avisoNoEntendido)
    }
    if (operacion === 'entrada') return entradaRecibirLineas(resuelto.lineas, resumenCantidades('Resumen de la entrada:', resuelto.lineas))
    if (operacion === 'baja') return bajaRecibirLineas(resuelto.lineas, resumenCantidades('Resumen de la baja:', resuelto.lineas))
    // Venta: el stock se verifica justo después de resolver los productos, antes del resumen y del
    // método de pago. Si algún producto no alcanza, se rechaza (no es "no entendido": no se guarda).
    const faltantes = faltantesDeStock(this.db, resuelto.lineas)
    if (faltantes.length) return ventaRechazada(M.ventaSinStock(faltantes))
    return ventaRecibirLineas(resuelto.lineas, resumenVenta(resuelto.lineas, money))
  }

  private registrarVenta(efecto: { lineas: LineaResuelta[]; metodoPago: MetodoPago }): Transicion {
    try {
      const venta = registrarVenta(this.db, {
        metodoPago: efecto.metodoPago,
        lineas: efecto.lineas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad }))
      })
      return registrado(ventaExito(venta.consecutivo, money(venta.total)))
    } catch (e) {
      // Respaldo: el backend vuelve a verificar el stock al confirmar (pudo cambiar mientras se
      // elegía el pago, p. ej. una venta en la app). Si ya no alcanza, la venta se rechaza.
      if (e instanceof ErrorApi && e.status === 400 && e.extra?.productos) return ventaRechazada(e.message)
      throw e
    }
  }

  private registrarEntrada(efecto: { lineas: LineaResuelta[]; referencia: string }): Transicion {
    const r = registrarEntrada(this.db, {
      referencia: efecto.referencia,
      lineas: efecto.lineas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad }))
    })
    return registrado(entradaExito(r.referencia, r.productos))
  }

  private registrarBaja(efecto: { lineas: LineaResuelta[]; motivo: MotivoBaja }): Transicion {
    // Punto 4 acordado: la baja que supera el stock se rechaza, sin registrar ninguna de las líneas.
    // Se valida todo antes de escribir; registrarBaja además es transaccional por línea.
    for (const l of efecto.lineas) {
      const stock = stockDe(this.db, l.productoId)
      if (l.cantidad > stock) return registrado(bajaRechazada(l.nombre, stock))
    }
    for (const l of efecto.lineas) {
      registrarBaja(this.db, { productoId: l.productoId, cantidad: l.cantidad, motivo: efecto.motivo })
    }
    return registrado(bajaExito(efecto.lineas.length))
  }
}

function salidaARespuesta(s: Salida): RespuestaChat {
  return { texto: s.texto, teclado: s.teclado }
}

export { tecladoPrincipal }
