import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { BaseDeDatos } from '../db/connection'
import { activoSchema, productoSchema } from '../../shared/esquemas'
import { noExiste, validar } from '../errores'
import { actualizarProducto, cambiarActivo, crearProducto, listarProductos } from './productos'

/** :id de la URL → entero positivo; si no, 404. */
export function idDe(params: unknown, mensaje = 'El producto no existe.'): number {
  const r = z.object({ id: z.coerce.number().int().positive() }).safeParse(params)
  if (!r.success) throw noExiste(mensaje)
  return r.data.id
}

const filtroSchema = z.object({
  q: z.string().optional(),
  activos: z.enum(['0', '1']).optional()
})

export function rutasProductos(app: FastifyInstance, db: BaseDeDatos): void {
  app.get('/productos', async (req) => {
    const f = validar(filtroSchema, req.query)
    return listarProductos(db, { q: f.q, activos: f.activos === '1' })
  })

  app.post('/productos', async (req, reply) => {
    const p = validar(productoSchema, req.body)
    return reply.code(201).send(crearProducto(db, p))
  })

  app.put('/productos/:id', async (req) => {
    const id = idDe(req.params)
    return actualizarProducto(db, id, validar(productoSchema, req.body))
  })

  app.patch('/productos/:id/activo', async (req) => {
    const id = idDe(req.params)
    return cambiarActivo(db, id, validar(activoSchema, req.body).activo)
  })
}
