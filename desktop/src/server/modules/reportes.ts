import type { FastifyInstance } from 'fastify'
import type { BaseDeDatos } from '../db/connection'
import { TOP_PRODUCTOS, TOP_PROVEEDORES, type Rotacion } from '../../shared/constantes'
import { rangoSchema, type Rango } from '../../shared/esquemas'
import { hoyColombia, limitesDia } from '../../shared/formato'
import type { FilaRotacion, TopProducto, TopProveedor } from '../../shared/tipos'
import { validar } from '../errores'
import { stocks } from './movimientos'

/** Rango de días (hora de Colombia) → instantes ISO UTC. */
function instantes(r: Rango): [string, string] {
  return [limitesDia(r.desde).desde, limitesDia(r.hasta).hasta]
}

/**
 * Rotación de los productos activos en el periodo, por tercios de unidades vendidas:
 * el tercio superior es "alta", el del medio "media" y el inferior "baja". Los productos
 * empatados quedan en la misma clase y los que no vendieron nada son siempre "baja".
 * Si no hubo ninguna venta en el periodo devuelve [] (la pantalla muestra un mensaje).
 */
export function reporteRotacion(db: BaseDeDatos, r: Rango): FilaRotacion[] {
  const [desde, hasta] = instantes(r)
  const hayVentas = db
    .prepare(`SELECT 1 FROM movimientos WHERE tipo = 'venta' AND fecha >= ? AND fecha <= ? LIMIT 1`)
    .get(desde, hasta)
  if (!hayVentas) return []
  const filas = db
    .prepare(
      `SELECT p.id, p.nombre, p.categoria,
         COALESCE((SELECT SUM(m.cantidad) FROM movimientos m
                   WHERE m.producto_id = p.id AND m.tipo = 'venta' AND m.fecha >= ? AND m.fecha <= ?), 0) AS vendidas
       FROM productos p WHERE p.activo = 1`
    )
    .all(desde, hasta) as { id: number; nombre: string; categoria: string; vendidas: number }[]
  filas.sort((a, b) => b.vendidas - a.vendidas || a.nombre.localeCompare(b.nombre, 'es'))
  const n = filas.length
  const st = stocks(db)
  let inicioEmpate = 0
  return filas.map((f, i) => {
    if (i > 0 && f.vendidas !== filas[i - 1].vendidas) inicioEmpate = i
    return { ...f, stock: st.get(f.id) ?? 0, rotacion: clasificar(f.vendidas, inicioEmpate, n) }
  })
}

/** Clase de rotación según la posición (la del primero de su grupo de empate) entre n productos. */
export function clasificar(vendidas: number, posicion: number, n: number): Rotacion {
  if (vendidas <= 0) return 'baja'
  if (posicion < Math.ceil(n / 3)) return 'alta'
  if (posicion < Math.ceil((2 * n) / 3)) return 'media'
  return 'baja'
}

/** Productos más vendidos en el periodo, ordenados por cantidad. */
export function reporteTopProductos(db: BaseDeDatos, r: Rango): TopProducto[] {
  const [desde, hasta] = instantes(r)
  return db
    .prepare(
      `SELECT p.id, p.nombre, SUM(m.cantidad) AS cantidad, SUM(m.cantidad * m.precio_unitario) AS valor
       FROM movimientos m JOIN productos p ON p.id = m.producto_id
       WHERE m.tipo = 'venta' AND m.fecha >= ? AND m.fecha <= ?
       GROUP BY p.id ORDER BY cantidad DESC, valor DESC, p.nombre LIMIT ?`
    )
    .all(desde, hasta, TOP_PRODUCTOS) as TopProducto[]
}

/**
 * Principales proveedores del periodo por valor comprado. Compras = entradas con proveedor;
 * cada una se valora con el precio de ese proveedor vigente el día de la entrada (el último
 * registrado hasta ese día; si no había ninguno, el primero registrado después; si no hay
 * precios, vale 0 pero sus unidades cuentan).
 */
export function reporteProveedores(db: BaseDeDatos, r: Rango): TopProveedor[] {
  const [desde, hasta] = instantes(r)
  const compras = db
    .prepare(
      `SELECT m.proveedor_id AS proveedorId, v.nombre, m.producto_id AS productoId, m.cantidad, m.referencia, m.fecha
       FROM movimientos m JOIN proveedores v ON v.id = m.proveedor_id
       WHERE m.tipo = 'entrada' AND m.proveedor_id IS NOT NULL AND m.fecha >= ? AND m.fecha <= ?`
    )
    .all(desde, hasta) as {
    proveedorId: number
    nombre: string
    productoId: number
    cantidad: number
    referencia: string
    fecha: string
  }[]
  const vigente = db.prepare(
    `SELECT precio FROM precios_proveedor WHERE proveedor_id = ? AND producto_id = ? AND fecha <= ?
     ORDER BY fecha DESC, id DESC LIMIT 1`
  )
  const posterior = db.prepare(
    `SELECT precio FROM precios_proveedor WHERE proveedor_id = ? AND producto_id = ?
     ORDER BY fecha, id LIMIT 1`
  )
  const porProveedor = new Map<number, TopProveedor & { refs: Set<string> }>()
  for (const c of compras) {
    const dia = hoyColombia(Date.parse(c.fecha))
    const p = (vigente.get(c.proveedorId, c.productoId, dia) ?? posterior.get(c.proveedorId, c.productoId)) as
      | { precio: number }
      | undefined
    const t = porProveedor.get(c.proveedorId) ?? {
      id: c.proveedorId,
      nombre: c.nombre,
      entradas: 0,
      unidades: 0,
      valor: 0,
      refs: new Set<string>()
    }
    t.refs.add(c.referencia)
    t.unidades += c.cantidad
    t.valor += c.cantidad * (p?.precio ?? 0)
    porProveedor.set(c.proveedorId, t)
  }
  return [...porProveedor.values()]
    .map(({ refs, ...t }) => ({ ...t, entradas: refs.size }))
    .sort((a, b) => b.valor - a.valor || b.unidades - a.unidades || a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, TOP_PROVEEDORES)
}

export function rutasReportes(app: FastifyInstance, db: BaseDeDatos): void {
  app.get('/reportes/rotacion', async (req) => reporteRotacion(db, validar(rangoSchema, req.query)))
  app.get('/reportes/top-productos', async (req) => reporteTopProductos(db, validar(rangoSchema, req.query)))
  app.get('/reportes/proveedores', async (req) => reporteProveedores(db, validar(rangoSchema, req.query)))
}
