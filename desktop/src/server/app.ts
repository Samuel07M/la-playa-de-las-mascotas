import Fastify, { type FastifyInstance } from 'fastify'
import type { BaseDeDatos } from './db/connection'

export interface OpcionesApp {
  /** Orígenes que pueden llamar a la API desde el navegador (la ventana de la app). */
  origenesPermitidos?: string[]
}

export function crearApp(db: BaseDeDatos, opciones: OpcionesApp = {}): FastifyInstance {
  const app = Fastify()
  const origenes = new Set(opciones.origenesPermitidos ?? [])

  // CORS mínimo, solo para la ventana de la app (en desarrollo la sirve Vite en otro puerto).
  app.addHook('onRequest', async (req, reply) => {
    const origen = req.headers.origin
    if (origen && origenes.has(origen)) {
      reply.header('Access-Control-Allow-Origin', origen)
      reply.header('Vary', 'Origin')
      reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE')
      reply.header('Access-Control-Allow-Headers', 'Content-Type')
    }
    if (req.method === 'OPTIONS') return reply.code(204).send()
  })

  app.get('/salud', async () => ({ ok: true, db: db.open }))

  return app
}
