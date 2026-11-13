import type { BaseDeDatos } from './connection'
import type { Categoria } from '../../shared/constantes'
import {
  MOTIVO_INVENTARIO_INICIAL,
  REF_INVENTARIO_INICIAL
} from '../../shared/constantes'
import { registrarMovimiento } from '../modules/movimientos'
import { registrarVenta } from '../modules/ventas'
import { registrarBaja } from '../modules/bajas'

// Datos de demostración: los mismos 8 productos, alias, inventario inicial, venta V-000
// y baja del mockup aprobado (función seed()). Solo se usa con `npm run seed`.
const PRODUCTOS: [string, Categoria, number, number, string[], number, boolean][] = [
  ['Concentrado Dog Chow Adulto 8kg', 'Alimento perros', 62000, 5, ['dog chow', 'chow grande'], 12, true],
  ['Concentrado Gatsy Gatos 3kg', 'Alimento gatos', 38000, 4, ['gatsy'], 3, true],
  ['Arena sanitaria 10kg', 'Higiene', 24000, 6, ['arena'], 15, true],
  ['Collar antipulgas pequeño', 'Accesorios', 18000, 3, ['collar'], 8, true],
  ['Snack Dentastix', 'Snacks', 9500, 10, ['dentastix', 'palitos'], 6, true],
  ['Shampoo para perros 500ml', 'Higiene', 21000, 3, [], 5, true],
  ['Plato de acero inoxidable', 'Accesorios', 12000, 4, [], 9, true],
  ['Juguete hueso de goma', 'Accesorios', 8000, 3, [], 4, false]
]

const DIA = 864e5

export function seed(db: BaseDeDatos, ahora = Date.now()): void {
  const hace = (dias: number) => new Date(ahora - dias * DIA).toISOString()
  db.transaction(() => {
    const ids: number[] = []
    for (const [nombre, categoria, precio, minimo, alias, inicial] of PRODUCTOS) {
      const id = Number(
        db
          .prepare(
            `INSERT INTO productos (nombre, categoria, precio_venta, stock_minimo, activo, creado_en)
             VALUES (?, ?, ?, ?, 1, ?)`
          )
          .run(nombre, categoria, precio, minimo, hace(7)).lastInsertRowid
      )
      ids.push(id)
      for (const a of alias) {
        db.prepare(`INSERT INTO alias (producto_id, texto, texto_normalizado) VALUES (?, ?, ?)`).run(
          id,
          a,
          a.toLowerCase()
        )
      }
      registrarMovimiento(db, {
        productoId: id,
        tipo: 'entrada',
        cantidad: inicial,
        motivo: MOTIVO_INVENTARIO_INICIAL,
        referencia: REF_INVENTARIO_INICIAL,
        fecha: hace(7)
      })
    }
    registrarVenta(
      db,
      { metodoPago: 'efectivo', lineas: [{ productoId: ids[2], cantidad: 2 }] },
      { consecutivo: 'V-000', fecha: hace(2) }
    )
    registrarBaja(db, { productoId: ids[0], cantidad: 1, motivo: 'vencido' }, hace(1))
    PRODUCTOS.forEach((p, i) => {
      if (!p[6]) db.prepare(`UPDATE productos SET activo = 0 WHERE id = ?`).run(ids[i])
    })
  })()
}
