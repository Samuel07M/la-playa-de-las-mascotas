import type { FastifyInstance } from 'fastify'
import type { BaseDeDatos } from '../db/connection'
import { aliasDesdeMensajeSchema, M } from '../../shared/esquemas'
import type { Mensaje } from '../../shared/tipos'
import { noExiste, validar } from '../errores'
import { agregarAlias } from './alias'
import { exigirActivo } from './productos'
import { idDe } from './productos.rutas'

interface FilaMensaje {
  id: number
  texto: string
  usuario: string
  fecha: string
  estado: Mensaje['estado']
  revisado: number
  productoId: number | null
  producto: string | null
  aliasTexto: string | null
}

const SELECT = `SELECT m.id, m.texto, m.usuario, m.fecha, m.estado, m.revisado,
  m.producto_id AS productoId, p.nombre AS producto, m.alias_texto AS aliasTexto
  FROM mensajes m LEFT JOIN productos p ON p.id = m.producto_id`

const aMensaje = (f: FilaMensaje): Mensaje => ({ ...f, revisado: f.revisado === 1 })

/** Guarda un mensaje del chat. Lo usará el chat operativo (HU-10 a HU-14); hoy solo el seed. */
export function registrarMensaje(
  db: BaseDeDatos,
  m: { texto: string; usuario: string; estado: Mensaje['estado']; fecha?: string }
): number {
  return Number(
    db
      .prepare(`INSERT INTO mensajes (texto, usuario, fecha, estado) VALUES (?, ?, ?, ?)`)
      .run(m.texto, m.usuario, m.fecha ?? new Date().toISOString(), m.estado).lastInsertRowid
  )
}

function obtenerMensaje(db: BaseDeDatos, id: number): Mensaje {
  const f = db.prepare(`${SELECT} WHERE m.id = ?`).get(id) as FilaMensaje | undefined
  if (!f) throw noExiste(M.mensajeNoExiste)
  return aMensaje(f)
}

/** Mensajes no entendidos; con pendientes, solo los que Isabel aún no marcó como revisados. */
export function listarNoEntendidos(db: BaseDeDatos, pendientes: boolean): Mensaje[] {
  return (
    db
      .prepare(
        `${SELECT} WHERE m.estado = 'no_entendido' ${pendientes ? 'AND m.revisado = 0' : ''} ORDER BY m.fecha DESC, m.id DESC`
      )
      .all() as FilaMensaje[]
  ).map(aMensaje)
}

/** Convierte el texto de un mensaje en alias de un producto (mismas reglas de HU-02). */
export function aliasDesdeMensaje(db: BaseDeDatos, id: number, productoId: number, texto: string): Mensaje {
  return db.transaction(() => {
    obtenerMensaje(db, id)
    exigirActivo(db, productoId, M.productoExistente, 'productoId')
    const a = agregarAlias(db, productoId, texto)
    db.prepare(`UPDATE mensajes SET producto_id = ?, alias_texto = ? WHERE id = ?`).run(productoId, a.texto, id)
    return obtenerMensaje(db, id)
  })()
}

export function marcarRevisado(db: BaseDeDatos, id: number): Mensaje {
  obtenerMensaje(db, id)
  db.prepare(`UPDATE mensajes SET revisado = 1 WHERE id = ?`).run(id)
  return obtenerMensaje(db, id)
}

export function rutasMensajes(app: FastifyInstance, db: BaseDeDatos): void {
  const idMsg = (params: unknown) => idDe(params, M.mensajeNoExiste)
  app.get('/mensajes', async (req) => listarNoEntendidos(db, (req.query as { pendientes?: string }).pendientes === '1'))
  app.post('/mensajes/:id/alias', async (req, reply) => {
    const id = idMsg(req.params)
    const b = validar(aliasDesdeMensajeSchema, req.body)
    return reply.code(201).send(aliasDesdeMensaje(db, id, b.productoId, b.texto))
  })
  app.patch('/mensajes/:id/revisado', async (req) => marcarRevisado(db, idMsg(req.params)))
}
