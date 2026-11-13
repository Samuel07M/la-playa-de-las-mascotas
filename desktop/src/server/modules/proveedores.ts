import type { FastifyInstance } from 'fastify'
import type { BaseDeDatos } from '../db/connection'
import {
  activoSchema,
  M,
  precioProveedorSchema,
  proveedorSchema,
  type PrecioProveedorEntrada,
  type ProveedorEntrada
} from '../../shared/esquemas'
import type { PrecioProveedor, Proveedor } from '../../shared/tipos'
import { ErrorApi, noExiste, validar } from '../errores'
import { exigirActivo, obtenerProducto } from './productos'
import { idDe } from './productos.rutas'

interface FilaProveedor {
  id: number
  nombre: string
  telefono: string | null
  correo: string | null
  activo: number
  precios: number
}

const SELECT = `SELECT v.id, v.nombre, v.telefono, v.correo, v.activo,
  (SELECT COUNT(*) FROM precios_proveedor pp WHERE pp.proveedor_id = v.id) AS precios
  FROM proveedores v`

const aProveedor = (f: FilaProveedor): Proveedor => ({ ...f, activo: f.activo === 1 })

export function listarProveedores(db: BaseDeDatos, soloActivos = false): Proveedor[] {
  return (
    db.prepare(`${SELECT} ${soloActivos ? 'WHERE v.activo = 1' : ''} ORDER BY v.nombre COLLATE NOCASE`).all() as FilaProveedor[]
  ).map(aProveedor)
}

export function obtenerProveedor(db: BaseDeDatos, id: number): Proveedor {
  const f = db.prepare(`${SELECT} WHERE v.id = ?`).get(id) as FilaProveedor | undefined
  if (!f) throw noExiste(M.proveedorNoExiste)
  return aProveedor(f)
}

/** Proveedor existente y activo; si no, 400 con el mensaje en el campo indicado. */
export function exigirProveedorActivo(db: BaseDeDatos, id: number, campo = 'proveedorId'): Proveedor {
  const f = db.prepare(`${SELECT} WHERE v.id = ?`).get(id) as FilaProveedor | undefined
  if (!f || f.activo !== 1) throw new ErrorApi(400, M.proveedorActivo, campo)
  return aProveedor(f)
}

export function crearProveedor(db: BaseDeDatos, p: ProveedorEntrada): Proveedor {
  const r = db
    .prepare(`INSERT INTO proveedores (nombre, telefono, correo, activo, creado_en) VALUES (?, ?, ?, 1, ?)`)
    .run(p.nombre, p.telefono, p.correo, new Date().toISOString())
  return obtenerProveedor(db, Number(r.lastInsertRowid))
}

export function actualizarProveedor(db: BaseDeDatos, id: number, p: ProveedorEntrada): Proveedor {
  obtenerProveedor(db, id)
  db.prepare(`UPDATE proveedores SET nombre = ?, telefono = ?, correo = ? WHERE id = ?`).run(
    p.nombre,
    p.telefono,
    p.correo,
    id
  )
  return obtenerProveedor(db, id)
}

/** Los proveedores no se eliminan: se desactivan y su historial de precios se conserva. */
export function cambiarActivoProveedor(db: BaseDeDatos, id: number, activo: boolean): Proveedor {
  obtenerProveedor(db, id)
  db.prepare(`UPDATE proveedores SET activo = ? WHERE id = ?`).run(activo ? 1 : 0, id)
  return obtenerProveedor(db, id)
}

/** Registra un precio de compra con su fecha. Siempre agrega una fila nueva al historial. */
export function registrarPrecio(
  db: BaseDeDatos,
  proveedorId: number,
  p: PrecioProveedorEntrada
): PrecioProveedor {
  obtenerProveedor(db, proveedorId)
  exigirProveedorActivo(db, proveedorId, 'proveedorId')
  exigirActivo(db, p.productoId, M.productoExistente, 'productoId')
  const r = db
    .prepare(
      `INSERT INTO precios_proveedor (proveedor_id, producto_id, precio, fecha, registrado_en) VALUES (?, ?, ?, ?, ?)`
    )
    .run(proveedorId, p.productoId, p.precio, p.fecha, new Date().toISOString())
  return preciosDe(db, { id: Number(r.lastInsertRowid) })[0]
}

const SELECT_PRECIOS = `SELECT pp.id, pp.proveedor_id AS proveedorId, v.nombre AS proveedor,
  pp.producto_id AS productoId, p.nombre AS producto, pp.precio, pp.fecha
  FROM precios_proveedor pp
  JOIN proveedores v ON v.id = pp.proveedor_id
  JOIN productos p ON p.id = pp.producto_id`

function preciosDe(db: BaseDeDatos, f: { id?: number; productoId?: number }): PrecioProveedor[] {
  const [cond, param] = f.id ? ['pp.id = ?', f.id] : ['pp.producto_id = ?', f.productoId!]
  return db
    .prepare(`${SELECT_PRECIOS} WHERE ${cond} ORDER BY v.nombre COLLATE NOCASE, pp.proveedor_id, pp.fecha, pp.id`)
    .all(param) as PrecioProveedor[]
}

/** Evolución del precio de un producto: historial agrupado por proveedor y en orden de fecha. */
export function preciosDeProducto(db: BaseDeDatos, productoId: number): PrecioProveedor[] {
  obtenerProducto(db, productoId)
  return preciosDe(db, { productoId })
}

export function rutasProveedores(app: FastifyInstance, db: BaseDeDatos): void {
  const idProv = (params: unknown) => idDe(params, M.proveedorNoExiste)

  app.get('/proveedores', async (req) => {
    const q = req.query as { activos?: string }
    return listarProveedores(db, q.activos === '1')
  })
  app.post('/proveedores', async (req, reply) =>
    reply.code(201).send(crearProveedor(db, validar(proveedorSchema, req.body)))
  )
  app.put('/proveedores/:id', async (req) =>
    actualizarProveedor(db, idProv(req.params), validar(proveedorSchema, req.body))
  )
  app.patch('/proveedores/:id/activo', async (req) =>
    cambiarActivoProveedor(db, idProv(req.params), validar(activoSchema, req.body).activo)
  )
  // HU-07 C4: eliminar no está permitido; solo desactivar.
  app.delete('/proveedores/:id', async (req) => {
    obtenerProveedor(db, idProv(req.params))
    throw new ErrorApi(409, M.proveedorSinEliminar)
  })
  app.post('/proveedores/:id/precios', async (req, reply) =>
    reply.code(201).send(registrarPrecio(db, idProv(req.params), validar(precioProveedorSchema, req.body)))
  )
  app.get('/productos/:id/precios', async (req) => preciosDeProducto(db, idDe(req.params)))
}
