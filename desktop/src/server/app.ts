import Fastify, { type FastifyInstance } from 'fastify'
import type { BaseDeDatos } from './db/connection'
import { ErrorApi } from './errores'
import { rutasProductos } from './modules/productos.rutas'
import { rutasAlias } from './modules/alias'
import { rutasVentas } from './modules/ventas'
import { rutasEntradas } from './modules/entradas'
import { rutasBajas } from './modules/bajas'
import { rutasInventario } from './modules/inventario'
import { rutasProveedores } from './modules/proveedores'
import { rutasCuadres } from './modules/cuadres'
import { rutasReportes } from './modules/reportes'

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

  // Errores siempre como { error: { campo?, mensaje } }.
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ErrorApi) {
      return reply
        .code(err.status)
        .send({ error: { ...(err.campo ? { campo: err.campo } : {}), mensaje: err.message, ...err.extra } })
    }
    const e = err as { statusCode?: number }
    if (e.statusCode && e.statusCode < 500) {
      return reply.code(e.statusCode).send({ error: { mensaje: 'Solicitud inválida.' } })
    }
    console.error(err)
    return reply.code(500).send({ error: { mensaje: 'Ocurrió un error inesperado.' } })
  })

  app.get('/salud', async () => ({ ok: true, db: db.open }))
  rutasProductos(app, db)
  rutasAlias(app, db)
  rutasVentas(app, db)
  rutasEntradas(app, db)
  rutasBajas(app, db)
  rutasInventario(app, db)
  rutasProveedores(app, db)
  rutasCuadres(app, db)
  rutasReportes(app, db)

  return app
}
