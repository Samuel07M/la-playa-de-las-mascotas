// Orquesta la conversación por cada chat y ejecuta los efectos contra la base de datos.
// Mantiene el estado de cada chat en memoria. Se prueba sin red inyectando el acceso a la BD.
// Criterio 3 de HU-10 (autorización) sigue aquí: solo los chats autorizados avanzan la conversación.

import type { BaseDeDatos } from '../db/connection'
import { money } from '../../shared/formato'
import { M } from '../../shared/esquemas'
import { ErrorApi } from '../errores'
import { registrarVenta } from '../modules/ventas'
import { listarProductos } from '../modules/productos'
import { registrarMensaje } from '../modules/mensajes'
import { estaAutorizado, tecladoPrincipal, type Teclado } from './logica'
import { NO_AUTORIZADO, VENTA_NO_ENTENDIDA, ventaExito } from './textos'
import { parsearVenta, resolverProductos, resumenVenta } from './ventas'
import {
  avanzar,
  pedirConfirmacionSobreStock,
  recibirLineas,
  ventaNoEntendida,
  ventaRegistrada,
  type Estado,
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

/** Guarda el mensaje como "no entendido" para que Isabel lo revise (HU-15 / puntos 3 y 4 acordados). */
function guardarPendiente(db: BaseDeDatos, texto: string, usuario: string): void {
  registrarMensaje(db, { texto, usuario, estado: 'no_entendido' })
}

/**
 * Procesa un mensaje de un chat autorizado y devuelve las respuestas a enviar.
 * `usuario` es el nombre visible del remitente (para dejarlo en el mensaje pendiente de HU-15).
 */
export class ManejadorChat {
  private estados = new Map<number, Estado>()

  constructor(
    private db: BaseDeDatos,
    private autorizados: readonly number[]
  ) {}

  private estadoDe(chatId: number): Estado {
    return this.estados.get(chatId) ?? { tipo: 'inactivo' }
  }

  private aplicar(chatId: number, t: Transicion): RespuestaChat[] {
    this.estados.set(chatId, t.estado)
    return t.salidas.map(salidaARespuesta)
  }

  procesar(chatId: number, texto: string, usuario: string): RespuestaChat[] {
    if (!estaAutorizado(chatId, this.autorizados)) {
      return [{ texto: NO_AUTORIZADO }]
    }

    let estado = this.estadoDe(chatId)
    let transicion = avanzar(estado, texto)

    // Resolver el efecto solicitado (puede encadenar: parsear → resumen o pendiente).
    while (transicion.efecto) {
      const efecto = transicion.efecto
      if (efecto.tipo === 'parsear_venta') {
        transicion = this.manejarParseo(efecto.texto, usuario)
      } else if (efecto.tipo === 'registrar_venta') {
        transicion = this.manejarRegistro(estado, efecto)
      }
      estado = transicion.estado
    }

    return this.aplicar(chatId, transicion)
  }

  private manejarParseo(texto: string, usuario: string): Transicion {
    const parseo = parsearVenta(texto)
    if (!parseo.ok) {
      guardarPendiente(this.db, texto, usuario)
      return ventaNoEntendida(VENTA_NO_ENTENDIDA)
    }
    const resuelto = resolverProductos(this.db, parseo.partes, buscarProductos)
    if (!resuelto.ok) {
      guardarPendiente(this.db, texto, usuario)
      return ventaNoEntendida(VENTA_NO_ENTENDIDA)
    }
    return recibirLineas(resuelto.lineas, resumenVenta(resuelto.lineas, money))
  }

  private manejarRegistro(
    estado: Estado,
    efecto: { lineas: { productoId: number; cantidad: number }[]; metodoPago: 'efectivo' | 'digital'; confirmarSobreStock: boolean }
  ): Transicion {
    try {
      const venta = registrarVenta(this.db, {
        metodoPago: efecto.metodoPago,
        lineas: efecto.lineas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad })),
        confirmarSobreStock: efecto.confirmarSobreStock
      })
      return ventaRegistrada(ventaExito(venta.consecutivo, money(venta.total)))
    } catch (e) {
      // 409 = la venta supera el stock: se advierte y se pide una segunda confirmación (punto 5).
      if (e instanceof ErrorApi && e.status === 409 && estado.tipo === 'esperando_confirmacion') {
        const productos = (e.extra?.productos as string[] | undefined) ?? []
        return pedirConfirmacionSobreStock(estado, M.sobreStock(productos))
      }
      throw e
    }
  }
}

function salidaARespuesta(s: Salida): RespuestaChat {
  return { texto: s.texto, teclado: s.teclado }
}

export { tecladoPrincipal }
