import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { BaseDeDatos } from '../db/connection'
import { USUARIO } from '../../shared/constantes'
import { cuadreSchema, fechaDia, M, type CuadreEntrada } from '../../shared/esquemas'
import { hoyColombia, limitesDia } from '../../shared/formato'
import type { Cuadre, DiaCaja } from '../../shared/tipos'
import { ErrorApi, validar } from '../errores'

interface FilaCuadre {
  id: number
  dia: string
  total_efectivo: number
  total_digital: number
  efectivo_contado: number
  diferencia: number
  usuario: string
  creado_en: string
}

const aCuadre = (f: FilaCuadre): Cuadre => ({
  id: f.id,
  dia: f.dia,
  totalEfectivo: f.total_efectivo,
  totalDigital: f.total_digital,
  efectivoContado: f.efectivo_contado,
  diferencia: f.diferencia,
  usuario: f.usuario,
  creadoEn: f.creado_en
})

function cuadreDe(db: BaseDeDatos, dia: string): Cuadre | null {
  const f = db.prepare(`SELECT * FROM cuadres_caja WHERE dia = ?`).get(dia) as FilaCuadre | undefined
  return f ? aCuadre(f) : null
}

/** Totales vendidos en un día (hora de Colombia) por método de pago, al precio de cada venta. */
export function totalesDelDia(db: BaseDeDatos, dia: string): DiaCaja {
  const { desde, hasta } = limitesDia(dia)
  const filas = db
    .prepare(
      `SELECT motivo, COALESCE(SUM(cantidad * precio_unitario), 0) AS total, COUNT(DISTINCT venta_id) AS ventas
       FROM movimientos WHERE tipo = 'venta' AND fecha >= ? AND fecha <= ? GROUP BY motivo`
    )
    .all(desde, hasta) as { motivo: string; total: number; ventas: number }[]
  const de = (m: string) => filas.find((f) => f.motivo === m)
  const totalEfectivo = de('efectivo')?.total ?? 0
  const totalDigital = de('digital')?.total ?? 0
  return {
    dia,
    ventas: filas.reduce((a, f) => a + f.ventas, 0),
    totalEfectivo,
    totalDigital,
    total: totalEfectivo + totalDigital,
    cuadre: cuadreDe(db, dia)
  }
}

/**
 * Guarda el cuadre de un día: diferencia = efectivo contado − total esperado en efectivo.
 * Los totales se calculan aquí (no se confía en la interfaz). Un solo cuadre por día.
 */
export function guardarCuadre(db: BaseDeDatos, c: CuadreEntrada): Cuadre {
  return db.transaction(() => {
    if (cuadreDe(db, c.dia)) throw new ErrorApi(409, M.cuadreExiste, 'dia')
    const t = totalesDelDia(db, c.dia)
    db.prepare(
      `INSERT INTO cuadres_caja (dia, total_efectivo, total_digital, efectivo_contado, diferencia, usuario, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      c.dia,
      t.totalEfectivo,
      t.totalDigital,
      c.efectivoContado,
      c.efectivoContado - t.totalEfectivo,
      USUARIO,
      new Date().toISOString()
    )
    return cuadreDe(db, c.dia)!
  })()
}

/** Cuadres guardados, del día más reciente al más antiguo. */
export function listarCuadres(db: BaseDeDatos): Cuadre[] {
  return (db.prepare(`SELECT * FROM cuadres_caja ORDER BY dia DESC`).all() as FilaCuadre[]).map(aCuadre)
}

const diaSchema = z.object({ fecha: fechaDia.optional() })

export function rutasCuadres(app: FastifyInstance, db: BaseDeDatos): void {
  app.get('/cuadres/dia', async (req) => totalesDelDia(db, validar(diaSchema, req.query).fecha ?? hoyColombia()))
  app.post('/cuadres', async (req, reply) => reply.code(201).send(guardarCuadre(db, validar(cuadreSchema, req.body))))
  app.get('/cuadres', async () => listarCuadres(db))
}
