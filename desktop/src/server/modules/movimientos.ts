import type { BaseDeDatos } from '../db/connection'
import type { TipoMovimiento } from '../../shared/constantes'
import { USUARIO } from '../../shared/constantes'
import type { Movimiento } from '../../shared/tipos'
import { limitesDia } from '../../shared/formato'

export interface NuevoMovimiento {
  productoId: number
  tipo: TipoMovimiento
  cantidad: number
  motivo: string
  referencia?: string | null
  detalle?: string | null
  ventaId?: number | null
  precioUnitario?: number | null
  usuario?: string
  fecha?: string
}

/** Único punto de escritura de movimientos: solo inserta. Nunca actualiza ni borra. */
export function registrarMovimiento(db: BaseDeDatos, m: NuevoMovimiento): number {
  const r = db
    .prepare(
      `INSERT INTO movimientos
        (producto_id, tipo, cantidad, motivo, referencia, detalle, venta_id, precio_unitario, usuario, fecha)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      m.productoId,
      m.tipo,
      m.cantidad,
      m.motivo,
      m.referencia ?? null,
      m.detalle || null,
      m.ventaId ?? null,
      m.precioUnitario ?? null,
      m.usuario ?? USUARIO,
      m.fecha ?? new Date().toISOString()
    )
  return Number(r.lastInsertRowid)
}

const SQL_STOCK = `COALESCE(SUM(CASE tipo WHEN 'entrada' THEN cantidad ELSE -cantidad END), 0)`

/** Stock = entradas − ventas − bajas, calculado en SQL. */
export function stockDe(db: BaseDeDatos, productoId: number): number {
  const r = db
    .prepare(`SELECT ${SQL_STOCK} AS s FROM movimientos WHERE producto_id = ?`)
    .get(productoId) as { s: number }
  return r.s
}

/** Stock de todos los productos con movimientos (los que no aparecen tienen stock 0). */
export function stocks(db: BaseDeDatos): Map<number, number> {
  const filas = db
    .prepare(`SELECT producto_id AS id, ${SQL_STOCK} AS s FROM movimientos GROUP BY producto_id`)
    .all() as { id: number; s: number }[]
  return new Map(filas.map((f) => [f.id, f.s]))
}

/** Suma de los movimientos recorriéndolos uno a uno (verificación independiente de stockDe). */
export function sumaMovimientos(db: BaseDeDatos, productoId: number): number {
  const filas = db
    .prepare(`SELECT tipo, cantidad FROM movimientos WHERE producto_id = ?`)
    .all(productoId) as { tipo: TipoMovimiento; cantidad: number }[]
  return filas.reduce((a, x) => a + (x.tipo === 'entrada' ? x.cantidad : -x.cantidad), 0)
}

export interface FiltroMovimientos {
  productoId?: number
  /** AAAA-MM-DD, día en hora de Colombia. */
  desde?: string
  hasta?: string
}

const SELECT_MOV = `SELECT m.id, m.producto_id AS productoId, p.nombre AS producto, m.tipo, m.cantidad,
       m.motivo, m.referencia, m.detalle, m.usuario, m.fecha
  FROM movimientos m JOIN productos p ON p.id = m.producto_id`

/** Historial de movimientos, del más reciente al más antiguo. */
export function listarMovimientos(db: BaseDeDatos, f: FiltroMovimientos = {}): Movimiento[] {
  const cond: string[] = []
  const params: (string | number)[] = []
  if (f.productoId) {
    cond.push('m.producto_id = ?')
    params.push(f.productoId)
  }
  if (f.desde) {
    cond.push('m.fecha >= ?')
    params.push(limitesDia(f.desde).desde)
  }
  if (f.hasta) {
    cond.push('m.fecha <= ?')
    params.push(limitesDia(f.hasta).hasta)
  }
  return db
    .prepare(
      `${SELECT_MOV} ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''} ORDER BY m.fecha DESC, m.id DESC`
    )
    .all(...params) as Movimiento[]
}

/** Movimientos de un tipo, del más reciente al más antiguo. */
export function movimientosDeTipo(db: BaseDeDatos, tipo: TipoMovimiento): Movimiento[] {
  return db
    .prepare(`${SELECT_MOV} WHERE m.tipo = ? ORDER BY m.fecha DESC, m.id DESC`)
    .all(tipo) as Movimiento[]
}
