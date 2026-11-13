import { describe, expect, it } from 'vitest'
import { nuevaApi, productoCon } from './ayudas'
import { listarMovimientos, stockDe } from '../modules/movimientos'
import { cantidadDe, cronometro, totalVenta } from '../../shared/venta'

describe('HU-03 · Registrar venta en mostrador', () => {
  it('C1: descuenta el stock de cada producto y guarda movimientos "venta" con usuario y fecha', async () => {
    const { app, db } = nuevaApi()
    const a = productoCon(db, 10, { nombre: 'Arena sanitaria 10kg', precioVenta: 24000 })
    const b = productoCon(db, 6, { nombre: 'Snack Dentastix', precioVenta: 9500 })
    const r = await app.inject({
      method: 'POST',
      url: '/ventas',
      payload: { metodoPago: 'digital', lineas: [{ productoId: a, cantidad: 2 }, { productoId: b, cantidad: 3 }] }
    })
    expect(r.statusCode).toBe(201)
    expect(r.json()).toMatchObject({ consecutivo: 'V-001', metodoPago: 'digital', total: 2 * 24000 + 3 * 9500 })
    expect(stockDe(db, a)).toBe(8)
    expect(stockDe(db, b)).toBe(3)
    const [m] = listarMovimientos(db, { productoId: a })
    expect(m).toMatchObject({ tipo: 'venta', cantidad: 2, motivo: 'digital', referencia: 'V-001', usuario: 'Isabel' })
    expect(Math.abs(Date.parse(m.fecha) - Date.now())).toBeLessThan(5000)
    const v = db.prepare(`SELECT metodo_pago, usuario FROM ventas`).get()
    expect(v).toEqual({ metodo_pago: 'digital', usuario: 'Isabel' })
  })

  it('C1: los consecutivos son V-001, V-002…', async () => {
    const { app, db } = nuevaApi()
    const a = productoCon(db, 10)
    const vender = () =>
      app.inject({ method: 'POST', url: '/ventas', payload: { metodoPago: 'efectivo', lineas: [{ productoId: a, cantidad: 1 }] } })
    expect((await vender()).json().consecutivo).toBe('V-001')
    expect((await vender()).json().consecutivo).toBe('V-002')
  })

  it('C1: guarda el precio unitario vigente (para el cuadre de caja)', async () => {
    const { app, db } = nuevaApi()
    const a = productoCon(db, 10, { precioVenta: 62000 })
    await app.inject({ method: 'POST', url: '/ventas', payload: { metodoPago: 'efectivo', lineas: [{ productoId: a, cantidad: 1 }] } })
    expect(db.prepare(`SELECT precio_unitario FROM movimientos WHERE tipo = 'venta'`).get()).toEqual({ precio_unitario: 62000 })
  })

  it('C2: si supera el stock, advierte (409) con los productos y no registra nada', async () => {
    const { app, db } = nuevaApi()
    const a = productoCon(db, 3, { nombre: 'Concentrado Gatsy Gatos 3kg' })
    const b = productoCon(db, 10, { nombre: 'Arena sanitaria 10kg' })
    const payload = { metodoPago: 'efectivo', lineas: [{ productoId: a, cantidad: 5 }, { productoId: b, cantidad: 1 }] }
    const r = await app.inject({ method: 'POST', url: '/ventas', payload })
    expect(r.statusCode).toBe(409)
    expect(r.json()).toEqual({
      error: {
        mensaje: 'Estos productos superan el stock disponible: Concentrado Gatsy Gatos 3kg. ¿Confirmas la venta de todos modos?',
        productos: ['Concentrado Gatsy Gatos 3kg']
      }
    })
    expect(stockDe(db, a)).toBe(3)
    expect(stockDe(db, b)).toBe(10)
  })

  it('C2: con confirmación explícita la venta se registra', async () => {
    const { app, db } = nuevaApi()
    const a = productoCon(db, 3)
    const r = await app.inject({
      method: 'POST',
      url: '/ventas',
      payload: { metodoPago: 'efectivo', lineas: [{ productoId: a, cantidad: 5 }], confirmarSobreStock: true }
    })
    expect(r.statusCode).toBe(201)
    expect(stockDe(db, a)).toBe(-2)
  })

  it('C2: suma las líneas repetidas del mismo producto al revisar el stock', async () => {
    const { app, db } = nuevaApi()
    const a = productoCon(db, 3)
    const r = await app.inject({
      method: 'POST',
      url: '/ventas',
      payload: { metodoPago: 'efectivo', lineas: [{ productoId: a, cantidad: 2 }, { productoId: a, cantidad: 2 }] }
    })
    expect(r.statusCode).toBe(409)
  })

  it('C3: el total se recalcula con cantidad × precio vigente', () => {
    expect(totalVenta([])).toBe(0)
    expect(totalVenta([{ cantidad: 2, precio: 62000 }, { cantidad: 3, precio: 9500 }])).toBe(152500)
    expect(totalVenta([{ cantidad: 1, precio: 62000 }])).toBe(62000)
  })

  it('las cantidades escritas en la venta son enteros ≥ 1 y el cronómetro es m:ss', () => {
    expect(cantidadDe('0')).toBe(1)
    expect(cantidadDe('abc')).toBe(1)
    expect(cantidadDe('4')).toBe(4)
    expect(cantidadDe(-3)).toBe(1)
    expect(cronometro(null)).toBe('0:00')
    expect(cronometro(1000, 1000 + 245_000)).toBe('4:05')
  })

  it.each([
    [{ metodoPago: 'tarjeta', lineas: [{ productoId: 1, cantidad: 1 }] }],
    [{ metodoPago: 'efectivo', lineas: [] }],
    [{ metodoPago: 'efectivo', lineas: [{ productoId: 1, cantidad: 0 }] }],
    [{ metodoPago: 'efectivo', lineas: [{ productoId: 1, cantidad: 1.5 }] }]
  ])('la API rechaza datos inválidos: %o', async (payload) => {
    const { app, db } = nuevaApi()
    productoCon(db, 5)
    const r = await app.inject({ method: 'POST', url: '/ventas', payload })
    expect(r.statusCode).toBe(400)
    expect(stockDe(db, 1)).toBe(5)
  })

  it('rechaza productos inexistentes o desactivados', async () => {
    const { app, db } = nuevaApi()
    const a = productoCon(db, 5)
    db.prepare('UPDATE productos SET activo = 0 WHERE id = ?').run(a)
    for (const productoId of [a, 99]) {
      const r = await app.inject({ method: 'POST', url: '/ventas', payload: { metodoPago: 'efectivo', lineas: [{ productoId, cantidad: 1 }] } })
      expect(r.json()).toEqual({ error: { campo: 'lineas.0.productoId', mensaje: 'Selecciona un producto existente.' } })
    }
  })
})
