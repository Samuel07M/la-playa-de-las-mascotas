import type { BaseDeDatos } from '../db/connection'
import type { Categoria } from '../../shared/constantes'
import type { ProductoEntrada } from '../../shared/esquemas'
import type { Alias, Producto } from '../../shared/tipos'
import { ErrorApi, noExiste } from '../errores'
import { stocks } from './movimientos'

interface FilaProducto {
  id: number
  nombre: string
  categoria: Categoria
  precio_venta: number
  stock_minimo: number
  activo: number
}

const SELECT = `SELECT id, nombre, categoria, precio_venta, stock_minimo, activo FROM productos`

function aProducto(f: FilaProducto, stock: number, alias: Alias[]): Producto {
  return {
    id: f.id,
    nombre: f.nombre,
    categoria: f.categoria,
    precioVenta: f.precio_venta,
    stockMinimo: f.stock_minimo,
    activo: f.activo === 1,
    stock,
    alias
  }
}

function aliasPorProducto(db: BaseDeDatos): Map<number, Alias[]> {
  const filas = db
    .prepare(`SELECT id, producto_id, texto FROM alias ORDER BY id`)
    .all() as { id: number; producto_id: number; texto: string }[]
  const m = new Map<number, Alias[]>()
  for (const f of filas) {
    const l = m.get(f.producto_id) ?? []
    l.push({ id: f.id, texto: f.texto })
    m.set(f.producto_id, l)
  }
  return m
}

export interface FiltroProductos {
  q?: string
  activos?: boolean
}

/**
 * Lista de productos con stock y alias. La búsqueda funciona igual que en el mockup:
 * coincide con nombre o categoría; si no, con un alias, y se indica cuál alias coincidió.
 */
export function listarProductos(db: BaseDeDatos, f: FiltroProductos = {}): Producto[] {
  const filas = db
    .prepare(`${SELECT} ${f.activos ? 'WHERE activo = 1' : ''} ORDER BY id`)
    .all() as FilaProducto[]
  const st = stocks(db)
  const al = aliasPorProducto(db)
  const lista = filas.map((x) => aProducto(x, st.get(x.id) ?? 0, al.get(x.id) ?? []))
  const s = (f.q ?? '').trim().toLowerCase()
  if (!s) return lista
  const r: Producto[] = []
  for (const p of lista) {
    if ((p.nombre + ' ' + p.categoria).toLowerCase().includes(s)) {
      r.push({ ...p, aliasCoincidente: null })
      continue
    }
    const a = p.alias.find((x) => x.texto.toLowerCase().includes(s))
    if (a) r.push({ ...p, aliasCoincidente: a.texto })
  }
  return r
}

export function obtenerProducto(db: BaseDeDatos, id: number): Producto {
  const f = db.prepare(`${SELECT} WHERE id = ?`).get(id) as FilaProducto | undefined
  if (!f) throw noExiste('El producto no existe.')
  return aProducto(f, stocks(db).get(id) ?? 0, aliasPorProducto(db).get(id) ?? [])
}

/** Producto existente y activo; si no, ErrorApi 400 con el mensaje y el campo indicados. */
export function exigirActivo(
  db: BaseDeDatos,
  id: number,
  mensaje: string,
  campo: string
): { id: number; nombre: string; precioVenta: number } {
  const f = db
    .prepare(`SELECT id, nombre, precio_venta, activo FROM productos WHERE id = ?`)
    .get(id) as { id: number; nombre: string; precio_venta: number; activo: number } | undefined
  if (!f || f.activo !== 1) throw new ErrorApi(400, mensaje, campo)
  return { id: f.id, nombre: f.nombre, precioVenta: f.precio_venta }
}

export function crearProducto(db: BaseDeDatos, p: ProductoEntrada, ahora = new Date()): Producto {
  const r = db
    .prepare(
      `INSERT INTO productos (nombre, categoria, precio_venta, stock_minimo, activo, creado_en)
       VALUES (?, ?, ?, ?, 1, ?)`
    )
    .run(p.nombre, p.categoria, p.precioVenta, p.stockMinimo, ahora.toISOString())
  return obtenerProducto(db, Number(r.lastInsertRowid))
}

export function actualizarProducto(db: BaseDeDatos, id: number, p: ProductoEntrada): Producto {
  obtenerProducto(db, id)
  db.prepare(
    `UPDATE productos SET nombre = ?, categoria = ?, precio_venta = ?, stock_minimo = ? WHERE id = ?`
  ).run(p.nombre, p.categoria, p.precioVenta, p.stockMinimo, id)
  return obtenerProducto(db, id)
}

export function cambiarActivo(db: BaseDeDatos, id: number, activo: boolean): Producto {
  obtenerProducto(db, id)
  db.prepare(`UPDATE productos SET activo = ? WHERE id = ?`).run(activo ? 1 : 0, id)
  return obtenerProducto(db, id)
}
