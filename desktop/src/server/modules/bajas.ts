import type { BaseDeDatos } from '../db/connection'
import { M, type BajaEntrada } from '../../shared/esquemas'
import type { Movimiento, ResumenBaja } from '../../shared/tipos'
import { ErrorApi } from '../errores'
import { movimientosDeTipo, registrarMovimiento, stockDe } from './movimientos'
import { exigirActivo } from './productos'

/** Registra una baja. Se rechaza si la cantidad supera el stock actual. */
export function registrarBaja(db: BaseDeDatos, b: BajaEntrada, fecha?: string): number {
  return db.transaction(() => {
    const p = exigirActivo(db, b.productoId, M.productoBaja, 'productoId')
    const stock = stockDe(db, p.id)
    if (b.cantidad > stock) throw new ErrorApi(400, M.bajaSuperaStock(stock), 'cantidad')
    return registrarMovimiento(db, {
      productoId: p.id,
      tipo: 'baja',
      cantidad: b.cantidad,
      motivo: b.motivo,
      detalle: b.detalle,
      fecha
    })
  })()
}

/** Historial de bajas, de la más reciente a la más antigua. */
export const listarBajas = (db: BaseDeDatos): Movimiento[] => movimientosDeTipo(db, 'baja')

/** Pérdidas por motivo, valoradas a precio de venta (como el mockup). Motivo más reciente primero. */
export function resumenBajas(db: BaseDeDatos): ResumenBaja[] {
  return db
    .prepare(
      `SELECT m.motivo, SUM(m.cantidad) AS cantidad, SUM(m.cantidad * p.precio_venta) AS valor
       FROM movimientos m JOIN productos p ON p.id = m.producto_id
       WHERE m.tipo = 'baja' GROUP BY m.motivo ORDER BY MAX(m.fecha) DESC, MAX(m.id) DESC`
    )
    .all() as ResumenBaja[]
}
