import { describe, expect, it } from 'vitest'
import { nuevaApi, productoCon } from './ayudas'
import { stockDe } from '../modules/movimientos'

describe('HU-05 · Registrar bajas con motivo', () => {
  it.each([[undefined], [''], ['robo']])('C1: sin motivo válido (%o) no permite guardar', async (motivo) => {
    const { app, db } = nuevaApi()
    const a = productoCon(db, 5)
    const r = await app.inject({ method: 'POST', url: '/bajas', payload: { productoId: a, cantidad: 1, motivo } })
    expect(r.statusCode).toBe(400)
    expect(r.json()).toEqual({ error: { campo: 'motivo', mensaje: 'Debes seleccionar un motivo para guardar.' } })
    expect(stockDe(db, a)).toBe(5)
  })

  it('C2: una baja válida disminuye el stock y guarda un movimiento "baja" con su motivo', async () => {
    const { app, db } = nuevaApi()
    const a = productoCon(db, 5)
    const r = await app.inject({
      method: 'POST',
      url: '/bajas',
      payload: { productoId: a, cantidad: 2, motivo: 'dañado', detalle: ' bolsa rota ' }
    })
    expect(r.statusCode).toBe(201)
    expect(stockDe(db, a)).toBe(3)
    const [m] = (await app.inject({ method: 'GET', url: '/bajas' })).json()
    expect(m).toMatchObject({ tipo: 'baja', cantidad: 2, motivo: 'dañado', detalle: 'bolsa rota', usuario: 'Isabel' })
  })

  it('C3: si la cantidad supera el stock actual la rechaza', async () => {
    const { app, db } = nuevaApi()
    const a = productoCon(db, 3)
    const r = await app.inject({ method: 'POST', url: '/bajas', payload: { productoId: a, cantidad: 4, motivo: 'vencido' } })
    expect(r.statusCode).toBe(400)
    expect(r.json()).toEqual({ error: { campo: 'cantidad', mensaje: 'La cantidad supera el stock actual (3).' } })
    expect(stockDe(db, a)).toBe(3)
  })

  it.each([
    [{ cantidad: 1, motivo: 'otro' }, 'productoId', 'Selecciona un producto.'],
    [{ productoId: 99, cantidad: 1, motivo: 'otro' }, 'productoId', 'Selecciona un producto.'],
    [{ productoId: 1, cantidad: 0, motivo: 'otro' }, 'cantidad', 'La cantidad debe ser un entero mayor que 0.'],
    [{ productoId: 1, cantidad: 1.5, motivo: 'otro' }, 'cantidad', 'La cantidad debe ser un entero mayor que 0.']
  ])('valida producto y cantidad: %o', async (payload, campo, mensaje) => {
    const { app, db } = nuevaApi()
    productoCon(db, 5)
    const r = await app.inject({ method: 'POST', url: '/bajas', payload })
    expect(r.json()).toEqual({ error: { campo, mensaje } })
  })

  it('C4: muestra las pérdidas por motivo valoradas a precio de venta', async () => {
    const { app, db } = nuevaApi()
    const a = productoCon(db, 10, { nombre: 'Concentrado Dog Chow Adulto 8kg', precioVenta: 62000 })
    const b = productoCon(db, 10, { nombre: 'Snack Dentastix', precioVenta: 9500 })
    const baja = (productoId: number, cantidad: number, motivo: string) =>
      app.inject({ method: 'POST', url: '/bajas', payload: { productoId, cantidad, motivo } })
    await baja(a, 1, 'vencido')
    await baja(b, 2, 'vencido')
    await baja(b, 1, 'dañado')
    const r = (await app.inject({ method: 'GET', url: '/bajas/resumen' })).json()
    expect(r).toEqual([
      { motivo: 'dañado', cantidad: 1, valor: 9500 },
      { motivo: 'vencido', cantidad: 3, valor: 62000 + 2 * 9500 }
    ])
    const hist = (await app.inject({ method: 'GET', url: '/bajas' })).json()
    expect(hist.map((x: { producto: string; motivo: string }) => `${x.producto}/${x.motivo}`)).toEqual([
      'Snack Dentastix/dañado',
      'Snack Dentastix/vencido',
      'Concentrado Dog Chow Adulto 8kg/vencido'
    ])
  })

  it('C4: sin bajas el resumen está vacío', async () => {
    const { app } = nuevaApi()
    expect((await app.inject({ method: 'GET', url: '/bajas/resumen' })).json()).toEqual([])
  })
})
