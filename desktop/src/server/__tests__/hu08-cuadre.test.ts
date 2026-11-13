import { describe, expect, it } from 'vitest'
import { nuevaApi, productoCon } from './ayudas'
import { registrarVenta } from '../modules/ventas'

describe('HU-08 · Cuadre de caja', () => {
  // 12 nov 2026 en hora de Colombia (UTC−5) va de 05:00Z del 12 a 04:59:59Z del 13.
  function conVentas() {
    const api = nuevaApi()
    const a = productoCon(api.db, 50, { precioVenta: 62000 })
    const b = productoCon(api.db, 50, { nombre: 'Snack Dentastix', precioVenta: 9500 })
    const vender = (metodoPago: 'efectivo' | 'digital', lineas: { productoId: number; cantidad: number }[], fecha: string) =>
      registrarVenta(api.db, { metodoPago, lineas }, { fecha })
    vender('efectivo', [{ productoId: a, cantidad: 1 }, { productoId: b, cantidad: 2 }], '2026-11-12T05:00:00.000Z') // 81.000
    vender('efectivo', [{ productoId: b, cantidad: 1 }], '2026-11-13T04:59:59.000Z') // 9.500
    vender('digital', [{ productoId: a, cantidad: 2 }], '2026-11-12T20:00:00.000Z') // 124.000
    vender('efectivo', [{ productoId: a, cantidad: 5 }], '2026-11-12T04:59:59.000Z') // 11 nov: no cuenta
    return { ...api, a }
  }

  it('C1: muestra el total vendido del día por método de pago', async () => {
    const { app } = conVentas()
    const r = (await app.inject({ method: 'GET', url: '/cuadres/dia?fecha=2026-11-12' })).json()
    expect(r).toEqual({ dia: '2026-11-12', ventas: 3, totalEfectivo: 90500, totalDigital: 124000, total: 214500, cuadre: null })
  })

  it('C1: usa el precio de la venta aunque el producto cambie de precio después', async () => {
    const { app, a } = conVentas()
    await app.inject({
      method: 'PUT',
      url: `/productos/${a}`,
      payload: { nombre: 'Concentrado Dog Chow Adulto 8kg', categoria: 'Alimento perros', precioVenta: 70000, stockMinimo: 5 }
    })
    const r = (await app.inject({ method: 'GET', url: '/cuadres/dia?fecha=2026-11-12' })).json()
    expect(r.totalDigital).toBe(124000)
  })

  it('C2 y C3: con el monto total contado (efectivo + digital) calcula la diferencia y lo guarda con su fecha', async () => {
    const { app } = conVentas()
    // Vendido: 90.500 en efectivo + 124.000 digital = 214.500. Contado: 85.500 + 124.000 = 209.500.
    const g = await app.inject({ method: 'POST', url: '/cuadres', payload: { dia: '2026-11-12', efectivoContado: 85500, digitalContado: 124000 } })
    expect(g.statusCode).toBe(201)
    expect(g.json()).toMatchObject({ dia: '2026-11-12', totalEfectivo: 90500, totalDigital: 124000, efectivoContado: 85500, digitalContado: 124000, diferencia: -5000, usuario: 'Isabel' })
    expect(g.json().creadoEn).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    const lista = (await app.inject({ method: 'GET', url: '/cuadres' })).json()
    expect(lista).toHaveLength(1)
    const dia = (await app.inject({ method: 'GET', url: '/cuadres/dia?fecha=2026-11-12' })).json()
    expect(dia.cuadre).toMatchObject({ diferencia: -5000 })
  })

  it('C3: un solo cuadre por día, que no se edita ni se borra', async () => {
    const { app, db } = conVentas()
    await app.inject({ method: 'POST', url: '/cuadres', payload: { dia: '2026-11-12', efectivoContado: 90500, digitalContado: 124000 } })
    const otra = await app.inject({ method: 'POST', url: '/cuadres', payload: { dia: '2026-11-12', efectivoContado: 1, digitalContado: 1 } })
    expect(otra.statusCode).toBe(409)
    expect(otra.json().error).toEqual({ campo: 'dia', mensaje: 'Ya hay un cuadre guardado para este día.' })
    expect(() => db.prepare('UPDATE cuadres_caja SET efectivo_contado = 0').run()).toThrow(/no se editan/)
    expect(() => db.prepare('DELETE FROM cuadres_caja').run()).toThrow(/no se borran/)
  })

  it('C2: valida los montos contados y el día', async () => {
    const { app } = nuevaApi()
    const m = 'Indica el efectivo contado (entero, 0 o más).'
    for (const efectivoContado of [-1, 10.5, '100', undefined]) {
      const r = await app.inject({ method: 'POST', url: '/cuadres', payload: { dia: '2026-11-12', efectivoContado, digitalContado: 0 } })
      expect(r.json().error).toEqual({ campo: 'efectivoContado', mensaje: m })
      const d = await app.inject({ method: 'POST', url: '/cuadres', payload: { dia: '2026-11-12', efectivoContado: 0, digitalContado: efectivoContado } })
      expect(d.json().error).toEqual({ campo: 'digitalContado', mensaje: 'Indica el monto digital recibido (entero, 0 o más).' })
    }
    const f = await app.inject({ method: 'POST', url: '/cuadres', payload: { dia: '12/11/2026', efectivoContado: 0, digitalContado: 0 } })
    expect(f.json().error).toEqual({ campo: 'dia', mensaje: 'Selecciona una fecha.' })
  })

  it('C4: un día sin ventas muestra cero sin errores y se puede cuadrar', async () => {
    const { app } = nuevaApi()
    const r = await app.inject({ method: 'GET', url: '/cuadres/dia?fecha=2026-11-01' })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ dia: '2026-11-01', ventas: 0, totalEfectivo: 0, totalDigital: 0, total: 0, cuadre: null })
    const g = await app.inject({ method: 'POST', url: '/cuadres', payload: { dia: '2026-11-01', efectivoContado: 0, digitalContado: 0 } })
    expect(g.json()).toMatchObject({ totalEfectivo: 0, totalDigital: 0, diferencia: 0 })
    expect((await app.inject({ method: 'GET', url: '/cuadres/dia' })).statusCode).toBe(200)
  })
})

describe('HU-08 · Migración v3 del cuadre', () => {
  it('los cuadres guardados antes de v3 se conservan con digitalContado null', async () => {
    const { abrirBaseDeDatos } = await import('../db/connection')
    const db = abrirBaseDeDatos(':memory:')
    expect(db.pragma('user_version', { simple: true })).toBe(3)
    db.prepare(
      `INSERT INTO cuadres_caja (dia, total_efectivo, total_digital, efectivo_contado, diferencia, usuario, creado_en)
       VALUES ('2026-11-10', 1000, 0, 900, -100, 'Isabel', '2026-11-11T01:00:00.000Z')`
    ).run()
    const { listarCuadres } = await import('../modules/cuadres')
    expect(listarCuadres(db)[0]).toMatchObject({ digitalContado: null, diferencia: -100 })
  })
})
