import { describe, expect, it } from 'vitest'
import { nuevaDb, productoCon } from './ayudas'
import { registrarMovimiento, stockDe, sumaMovimientos } from '../modules/movimientos'
import { registrarBaja } from '../modules/bajas'
import { registrarVenta } from '../modules/ventas'
import { ErrorApi } from '../errores'
import { seed } from '../db/seed'
import { listarProductos } from '../modules/productos'

describe('Invariante de stock (entradas − ventas − bajas)', () => {
  it('el stock es la suma de los movimientos', () => {
    const db = nuevaDb()
    const id = productoCon(db, 10)
    registrarMovimiento(db, { productoId: id, tipo: 'entrada', cantidad: 5, motivo: 'Recepción', referencia: 'FAC-1' })
    registrarVenta(db, { metodoPago: 'efectivo', lineas: [{ productoId: id, cantidad: 3 }] })
    registrarBaja(db, { productoId: id, cantidad: 2, motivo: 'dañado' })
    expect(stockDe(db, id)).toBe(10 + 5 - 3 - 2)
    expect(sumaMovimientos(db, id)).toBe(stockDe(db, id))
  })

  it('un producto sin movimientos tiene stock 0', () => {
    const db = nuevaDb()
    expect(stockDe(db, productoCon(db))).toBe(0)
  })

  it('los movimientos no se pueden editar ni borrar', () => {
    const db = nuevaDb()
    productoCon(db, 4)
    expect(() => db.prepare('UPDATE movimientos SET cantidad = 99').run()).toThrow(/no se editan/)
    expect(() => db.prepare('DELETE FROM movimientos').run()).toThrow(/no se borran/)
  })

  it('los productos no se pueden eliminar (solo desactivar)', () => {
    const db = nuevaDb()
    productoCon(db)
    expect(() => db.prepare('DELETE FROM productos').run()).toThrow(/se desactivan/)
  })

  it('la BD rechaza cantidades no positivas, bajas sin motivo válido y entradas sin referencia', () => {
    const db = nuevaDb()
    const id = productoCon(db, 4)
    const base = { productoId: id, motivo: 'Recepción', referencia: 'FAC-1' }
    expect(() => registrarMovimiento(db, { ...base, tipo: 'entrada', cantidad: 0 })).toThrow()
    expect(() => registrarMovimiento(db, { ...base, tipo: 'entrada', cantidad: 2, referencia: ' ' })).toThrow()
    expect(() => registrarMovimiento(db, { productoId: id, tipo: 'baja', cantidad: 1, motivo: 'robo' })).toThrow()
  })
})

describe('Baja que supera el stock', () => {
  it('se rechaza y no registra nada', () => {
    const db = nuevaDb()
    const id = productoCon(db, 3)
    expect(() => registrarBaja(db, { productoId: id, cantidad: 4, motivo: 'vencido' })).toThrowError(
      new ErrorApi(400, 'La cantidad supera el stock actual (3).', 'cantidad')
    )
    expect(stockDe(db, id)).toBe(3)
  })

  it('igual al stock se permite', () => {
    const db = nuevaDb()
    const id = productoCon(db, 3)
    registrarBaja(db, { productoId: id, cantidad: 3, motivo: 'vencido' })
    expect(stockDe(db, id)).toBe(0)
  })
})

describe('Venta que supera el stock', () => {
  it('sin confirmación devuelve conflicto con los productos afectados', () => {
    const db = nuevaDb()
    const id = productoCon(db, 2, { nombre: 'Concentrado Gatsy Gatos 3kg' })
    try {
      registrarVenta(db, { metodoPago: 'digital', lineas: [{ productoId: id, cantidad: 3 }] })
      expect.unreachable()
    } catch (e) {
      const err = e as ErrorApi
      expect(err.status).toBe(409)
      expect(err.extra).toEqual({ productos: ['Concentrado Gatsy Gatos 3kg'] })
    }
    expect(stockDe(db, id)).toBe(2)
  })

  it('con confirmación se registra (el stock puede quedar negativo)', () => {
    const db = nuevaDb()
    const id = productoCon(db, 2)
    registrarVenta(db, {
      metodoPago: 'digital',
      lineas: [{ productoId: id, cantidad: 3 }],
      confirmarSobreStock: true
    })
    expect(stockDe(db, id)).toBe(-1)
  })
})

describe('Seed de demostración', () => {
  it('carga los datos del mockup', () => {
    const db = nuevaDb()
    seed(db)
    const ps = listarProductos(db)
    expect(ps).toHaveLength(8)
    expect(ps.map((p) => p.stock)).toEqual([11, 3, 13, 8, 6, 5, 9, 4])
    expect(ps[0].alias.map((a) => a.texto)).toEqual(['dog chow', 'chow grande'])
    expect(ps[7].activo).toBe(false)
    expect(db.prepare(`SELECT consecutivo FROM ventas`).all()).toEqual([{ consecutivo: 'V-000' }])
  })
})
