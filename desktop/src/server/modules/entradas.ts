import type { FastifyInstance } from 'fastify'
import type { BaseDeDatos } from '../db/connection'
import { MOTIVO_ENTRADA, REF_INVENTARIO_INICIAL } from '../../shared/constantes'
import { entradaSchema, M, type EntradaEntrada } from '../../shared/esquemas'
import type { EntradaReciente } from '../../shared/tipos'
import { validar } from '../errores'
import { registrarMovimiento } from './movimientos'
import { exigirActivo } from './productos'
import { exigirProveedorActivo } from './proveedores'

/** Registra una recepción: un movimiento "entrada" por producto, todos con la misma referencia. */
export function registrarEntrada(
  db: BaseDeDatos,
  e: EntradaEntrada,
  fecha?: string
): { referencia: string; productos: number } {
  return db.transaction(() => {
    const productos = e.lineas.map((l, i) =>
      exigirActivo(db, l.productoId, M.productoExistente, `lineas.${i}.productoId`)
    )
    if (e.proveedorId) exigirProveedorActivo(db, e.proveedorId)
    const f = fecha ?? new Date().toISOString()
    e.lineas.forEach((l, i) =>
      registrarMovimiento(db, {
        productoId: productos[i].id,
        tipo: 'entrada',
        cantidad: l.cantidad,
        motivo: MOTIVO_ENTRADA,
        referencia: e.referencia,
        proveedorId: e.proveedorId ?? null,
        fecha: f
      })
    )
    return { referencia: e.referencia, productos: e.lineas.length }
  })()
}

/** Últimas entradas agrupadas por referencia (sin el inventario inicial), como en el mockup. */
export function entradasRecientes(db: BaseDeDatos, limite = 5): EntradaReciente[] {
  const grupos = db
    .prepare(
      `SELECT referencia, MIN(id) AS primero FROM movimientos
       WHERE tipo = 'entrada' AND referencia <> ?
       GROUP BY referencia ORDER BY primero DESC LIMIT ?`
    )
    .all(REF_INVENTARIO_INICIAL, limite) as { referencia: string; primero: number }[]
  const detalle = db.prepare(
    `SELECT m.id, m.fecha, m.cantidad, p.nombre FROM movimientos m JOIN productos p ON p.id = m.producto_id
     WHERE m.tipo = 'entrada' AND m.referencia = ? ORDER BY m.id`
  )
  return grupos.map((g) => {
    const filas = detalle.all(g.referencia) as { id: number; fecha: string; cantidad: number; nombre: string }[]
    return {
      referencia: g.referencia,
      fecha: filas[0].fecha,
      productos: filas.map((f) => ({ nombre: f.nombre, cantidad: f.cantidad }))
    }
  })
}

export function rutasEntradas(app: FastifyInstance, db: BaseDeDatos): void {
  app.post('/entradas', async (req, reply) => {
    return reply.code(201).send(registrarEntrada(db, validar(entradaSchema, req.body)))
  })
  app.get('/entradas/recientes', async () => entradasRecientes(db))
}
