import { describe, expect, it } from 'vitest'
import { nuevaApi, productoCon } from './ayudas'
import { listarMovimientos, stockDe } from '../modules/movimientos'

describe('HU-04 · Registrar entrada de mercancía', () => {
  it('C1: aumenta el stock y guarda un movimiento "entrada"', async () => {
    const { app, db } = nuevaApi()
    const a = productoCon(db, 2)
    const r = await app.inject({
      method: 'POST',
      url: '/entradas',
      payload: { referencia: ' FAC-1042 ', lineas: [{ productoId: a, cantidad: 12 }] }
    })
    expect(r.statusCode).toBe(201)
    expect(r.json()).toEqual({ referencia: 'FAC-1042', productos: 1 })
    expect(stockDe(db, a)).toBe(14)
    const [m] = listarMovimientos(db, { productoId: a })
    expect(m).toMatchObject({ tipo: 'entrada', cantidad: 12, motivo: 'Recepción', referencia: 'FAC-1042', usuario: 'Isabel' })
  })

  it.each([
    [{ referencia: '', lineas: [{ productoId: 1, cantidad: 1 }] }, 'referencia', 'La referencia es obligatoria.'],
    [{ referencia: '   ', lineas: [{ productoId: 1, cantidad: 1 }] }, 'referencia', 'La referencia es obligatoria.'],
    [{ referencia: 'R-1', lineas: [{ productoId: 1, cantidad: 0 }] }, 'lineas.0.cantidad', 'La cantidad debe ser un entero mayor que 0.'],
    [{ referencia: 'R-1', lineas: [{ productoId: 1, cantidad: -4 }] }, 'lineas.0.cantidad', 'La cantidad debe ser un entero mayor que 0.'],
    [{ referencia: 'R-1', lineas: [{ productoId: 1, cantidad: 2.5 }] }, 'lineas.0.cantidad', 'La cantidad debe ser un entero mayor que 0.'],
    [{ referencia: 'R-1', lineas: [{ productoId: 99, cantidad: 1 }] }, 'lineas.0.productoId', 'Selecciona un producto existente.'],
    [{ referencia: 'R-1', lineas: [{ cantidad: 1 }] }, 'lineas.0.productoId', 'Selecciona un producto existente.']
  ])('C2: rechaza %o e indica el error', async (payload, campo, mensaje) => {
    const { app, db } = nuevaApi()
    productoCon(db, 5)
    const r = await app.inject({ method: 'POST', url: '/entradas', payload })
    expect(r.statusCode).toBe(400)
    expect(r.json()).toEqual({ error: { campo, mensaje } })
    expect(stockDe(db, 1)).toBe(5)
  })

  it('C2: no se puede registrar entrada de un producto desactivado', async () => {
    const { app, db } = nuevaApi()
    const a = productoCon(db, 5)
    await app.inject({ method: 'PATCH', url: `/productos/${a}/activo`, payload: { activo: false } })
    const r = await app.inject({ method: 'POST', url: '/entradas', payload: { referencia: 'R-1', lineas: [{ productoId: a, cantidad: 1 }] } })
    expect(r.json().error.mensaje).toBe('Selecciona un producto existente.')
  })

  it('C2: si una línea falla no se registra ninguna', async () => {
    const { app, db } = nuevaApi()
    const a = productoCon(db, 5)
    await app.inject({
      method: 'POST',
      url: '/entradas',
      payload: { referencia: 'R-1', lineas: [{ productoId: a, cantidad: 3 }, { productoId: 99, cantidad: 1 }] }
    })
    expect(stockDe(db, a)).toBe(5)
  })

  it('C3: varios productos de una recepción quedan con la misma referencia', async () => {
    const { app, db } = nuevaApi()
    const a = productoCon(db, 0, { nombre: 'Arena sanitaria 10kg' })
    const b = productoCon(db, 0, { nombre: 'Snack Dentastix' })
    const r = await app.inject({
      method: 'POST',
      url: '/entradas',
      payload: { referencia: 'REM-77', lineas: [{ productoId: a, cantidad: 10 }, { productoId: b, cantidad: 24 }] }
    })
    expect(r.json()).toEqual({ referencia: 'REM-77', productos: 2 })
    const refs = db.prepare(`SELECT DISTINCT referencia FROM movimientos WHERE tipo = 'entrada'`).all()
    expect(refs).toEqual([{ referencia: 'REM-77' }])
  })

  it('C4: el historial coincide con la factura o remisión (y excluye el inventario inicial)', async () => {
    const { app, db } = nuevaApi()
    const a = productoCon(db, 8, { nombre: 'Arena sanitaria 10kg' })
    const b = productoCon(db, 0, { nombre: 'Snack Dentastix' })
    await app.inject({ method: 'POST', url: '/entradas', payload: { referencia: 'FAC-1', lineas: [{ productoId: a, cantidad: 5 }] } })
    await app.inject({
      method: 'POST',
      url: '/entradas',
      payload: { referencia: 'FAC-2', lineas: [{ productoId: a, cantidad: 10 }, { productoId: b, cantidad: 24 }] }
    })
    const r = (await app.inject({ method: 'GET', url: '/entradas/recientes' })).json()
    expect(r.map((x: { referencia: string }) => x.referencia)).toEqual(['FAC-2', 'FAC-1'])
    expect(r[0].productos).toEqual([
      { nombre: 'Arena sanitaria 10kg', cantidad: 10 },
      { nombre: 'Snack Dentastix', cantidad: 24 }
    ])
    const hist = listarMovimientos(db, { productoId: b })
    expect(hist).toMatchObject([{ tipo: 'entrada', cantidad: 24, referencia: 'FAC-2' }])
  })

  it('muestra solo las últimas 5 recepciones', async () => {
    const { app, db } = nuevaApi()
    const a = productoCon(db)
    for (let i = 1; i <= 7; i++) {
      await app.inject({ method: 'POST', url: '/entradas', payload: { referencia: `R-${i}`, lineas: [{ productoId: a, cantidad: 1 }] } })
    }
    const r = (await app.inject({ method: 'GET', url: '/entradas/recientes' })).json()
    expect(r.map((x: { referencia: string }) => x.referencia)).toEqual(['R-7', 'R-6', 'R-5', 'R-4', 'R-3'])
  })
})
