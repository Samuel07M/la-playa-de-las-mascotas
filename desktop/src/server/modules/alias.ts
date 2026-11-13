import type { FastifyInstance } from 'fastify'
import type { BaseDeDatos } from '../db/connection'
import { aliasSchema, M } from '../../shared/esquemas'
import type { Alias } from '../../shared/tipos'
import { ErrorApi, noExiste, validar } from '../errores'
import { obtenerProducto } from './productos'
import { idDe } from './productos.rutas'

/** Producto al que pertenece un alias (comparación sin distinguir mayúsculas/minúsculas). */
export function duenoDelAlias(db: BaseDeDatos, texto: string): string | null {
  const r = db
    .prepare(
      `SELECT p.nombre FROM alias a JOIN productos p ON p.id = a.producto_id WHERE a.texto_normalizado = ?`
    )
    .get(texto.trim().toLowerCase()) as { nombre: string } | undefined
  return r?.nombre ?? null
}

/** Agrega un alias a un producto. Un alias pertenece a un solo producto. */
export function agregarAlias(db: BaseDeDatos, productoId: number, texto: string): Alias {
  obtenerProducto(db, productoId)
  const limpio = texto.trim()
  const dueno = duenoDelAlias(db, limpio)
  if (dueno) throw new ErrorApi(409, M.aliasDuplicado(dueno), 'texto')
  const r = db
    .prepare(`INSERT INTO alias (producto_id, texto, texto_normalizado) VALUES (?, ?, ?)`)
    .run(productoId, limpio, limpio.toLowerCase())
  return { id: Number(r.lastInsertRowid), texto: limpio }
}

/** Quita un alias. El producto y su historial no se tocan. */
export function eliminarAlias(db: BaseDeDatos, id: number): void {
  const r = db.prepare(`DELETE FROM alias WHERE id = ?`).run(id)
  if (r.changes === 0) throw noExiste('El alias no existe.')
}

export function rutasAlias(app: FastifyInstance, db: BaseDeDatos): void {
  app.post('/productos/:id/alias', async (req, reply) => {
    const id = idDe(req.params)
    const { texto } = validar(aliasSchema, req.body)
    return reply.code(201).send(agregarAlias(db, id, texto))
  })

  app.delete('/alias/:id', async (req, reply) => {
    eliminarAlias(db, idDe(req.params, 'El alias no existe.'))
    return reply.code(204).send()
  })
}
