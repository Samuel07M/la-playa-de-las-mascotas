import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { BaseDeDatos } from '../db/connection'
import { fechaDia } from '../../shared/esquemas'
import type { FilaInventario, Verificacion } from '../../shared/tipos'
import { validar } from '../errores'
import { listarMovimientos, stockDe, stocks, sumaMovimientos } from './movimientos'
import { obtenerProducto } from './productos'
import { idDe } from './productos.rutas'

/** Stock de los productos activos: primero los que están bajo el mínimo, luego por nombre. */
export function inventario(db: BaseDeDatos): FilaInventario[] {
  const filas = db
    .prepare(`SELECT id, nombre, categoria, stock_minimo FROM productos WHERE activo = 1`)
    .all() as { id: number; nombre: string; categoria: string; stock_minimo: number }[]
  const st = stocks(db)
  return filas
    .map((p) => {
      const stock = st.get(p.id) ?? 0
      return {
        id: p.id,
        nombre: p.nombre,
        categoria: p.categoria,
        stock,
        stockMinimo: p.stock_minimo,
        bajoMinimo: stock < p.stock_minimo
      }
    })
    .sort((a, b) => Number(b.bajoMinimo) - Number(a.bajoMinimo) || a.nombre.localeCompare(b.nombre, 'es'))
}

/** Compara la suma de los movimientos con el stock mostrado (invariante de HU-06). */
export function verificar(db: BaseDeDatos, productoId: number): Verificacion {
  obtenerProducto(db, productoId)
  const sumaMov = sumaMovimientos(db, productoId)
  const stockMostrado = stockDe(db, productoId)
  return { productoId, sumaMovimientos: sumaMov, stockMostrado, coinciden: sumaMov === stockMostrado }
}

const filtroSchema = z.object({
  productoId: z.coerce.number().int().positive().optional(),
  desde: fechaDia.optional(),
  hasta: fechaDia.optional()
})

export function rutasInventario(app: FastifyInstance, db: BaseDeDatos): void {
  app.get('/inventario', async () => inventario(db))
  app.get('/inventario/:id/verificacion', async (req) => verificar(db, idDe(req.params)))
  app.get('/movimientos', async (req) => listarMovimientos(db, validar(filtroSchema, req.query)))
}
