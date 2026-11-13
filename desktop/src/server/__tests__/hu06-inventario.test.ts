import { describe, expect, it } from 'vitest'
import { nuevaApi, productoCon } from './ayudas'
import { registrarMovimiento } from '../modules/movimientos'
import { registrarVenta } from '../modules/ventas'
import { registrarBaja } from '../modules/bajas'
import { seed } from '../db/seed'

describe('HU-06 · Consultar stock, historial y alertas', () => {
  it('C1: muestra el stock actual de cada producto activo', async () => {
    const { app, db } = nuevaApi()
    const a = productoCon(db, 12, { nombre: 'Arena sanitaria 10kg', stockMinimo: 6 })
    const b = productoCon(db, 3, { nombre: 'Collar antipulgas pequeño', stockMinimo: 3 })
    const c = productoCon(db, 4, { nombre: 'Juguete hueso de goma', stockMinimo: 3 })
    await app.inject({ method: 'PATCH', url: `/productos/${c}/activo`, payload: { activo: false } })
    const r = (await app.inject({ method: 'GET', url: '/inventario' })).json()
    expect(r).toEqual([
      { id: a, nombre: 'Arena sanitaria 10kg', categoria: 'Alimento perros', stock: 12, stockMinimo: 6, bajoMinimo: false },
      { id: b, nombre: 'Collar antipulgas pequeño', categoria: 'Alimento perros', stock: 3, stockMinimo: 3, bajoMinimo: false }
    ])
  })

  it('C2: los productos bajo el mínimo van primero y marcados', async () => {
    const { app, db } = nuevaApi()
    productoCon(db, 12, { nombre: 'Arena sanitaria 10kg', stockMinimo: 6 })
    productoCon(db, 6, { nombre: 'Snack Dentastix', stockMinimo: 10 })
    productoCon(db, 9, { nombre: 'Plato de acero inoxidable', stockMinimo: 4 })
    productoCon(db, 3, { nombre: 'Concentrado Gatsy Gatos 3kg', stockMinimo: 4 })
    const r = (await app.inject({ method: 'GET', url: '/inventario' })).json()
    expect(r.map((x: { nombre: string; bajoMinimo: boolean }) => [x.nombre, x.bajoMinimo])).toEqual([
      ['Concentrado Gatsy Gatos 3kg', true],
      ['Snack Dentastix', true],
      ['Arena sanitaria 10kg', false],
      ['Plato de acero inoxidable', false]
    ])
  })

  it('C2: con los datos del mockup alerta Gatsy y Dentastix', async () => {
    const { app, db } = nuevaApi()
    seed(db)
    const r = (await app.inject({ method: 'GET', url: '/inventario' })).json()
    expect(r.filter((x: { bajoMinimo: boolean }) => x.bajoMinimo).map((x: { nombre: string }) => x.nombre)).toEqual([
      'Concentrado Gatsy Gatos 3kg',
      'Snack Dentastix'
    ])
  })

  it('C3: filtra por producto y rango de fechas y muestra tipo, cantidad, motivo, usuario y fecha', async () => {
    const { app, db } = nuevaApi()
    const a = productoCon(db, 0)
    const b = productoCon(db, 0, { nombre: 'Snack Dentastix' })
    // Fechas en hora de Colombia (UTC−5).
    registrarMovimiento(db, { productoId: a, tipo: 'entrada', cantidad: 10, motivo: 'Recepción', referencia: 'FAC-1', fecha: '2026-11-10T04:59:00.000Z' }) // 9 nov 23:59
    registrarMovimiento(db, { productoId: a, tipo: 'entrada', cantidad: 5, motivo: 'Recepción', referencia: 'FAC-2', fecha: '2026-11-10T05:00:00.000Z' }) // 10 nov 00:00
    registrarVenta(db, { metodoPago: 'efectivo', lineas: [{ productoId: a, cantidad: 2 }] }, { fecha: '2026-11-11T15:00:00.000Z' })
    registrarBaja(db, { productoId: a, cantidad: 1, motivo: 'vencido' }, '2026-11-12T04:59:59.000Z') // 11 nov 23:59
    registrarMovimiento(db, { productoId: b, tipo: 'entrada', cantidad: 3, motivo: 'Recepción', referencia: 'FAC-3', fecha: '2026-11-11T15:00:00.000Z' })

    const r = (await app.inject({ method: 'GET', url: `/movimientos?productoId=${a}&desde=2026-11-10&hasta=2026-11-11` })).json()
    expect(r).toEqual([
      expect.objectContaining({ tipo: 'baja', cantidad: 1, motivo: 'vencido', usuario: 'Isabel', fecha: '2026-11-12T04:59:59.000Z' }),
      expect.objectContaining({ tipo: 'venta', cantidad: 2, motivo: 'efectivo', referencia: 'V-001', usuario: 'Isabel' }),
      expect.objectContaining({ tipo: 'entrada', cantidad: 5, motivo: 'Recepción', referencia: 'FAC-2', usuario: 'Isabel' })
    ])
    const todos = (await app.inject({ method: 'GET', url: '/movimientos' })).json()
    expect(todos).toHaveLength(5)
    const soloB = (await app.inject({ method: 'GET', url: `/movimientos?productoId=${b}` })).json()
    expect(soloB).toHaveLength(1)
  })

  it('C3: rechaza fechas con formato inválido', async () => {
    const { app } = nuevaApi()
    const r = await app.inject({ method: 'GET', url: '/movimientos?desde=12/11/2026' })
    expect(r.statusCode).toBe(400)
  })

  it('C4: la suma de los movimientos coincide con el stock mostrado', async () => {
    const { app, db } = nuevaApi()
    const a = productoCon(db, 10)
    await app.inject({ method: 'POST', url: '/entradas', payload: { referencia: 'FAC-1', lineas: [{ productoId: a, cantidad: 7 }] } })
    await app.inject({ method: 'POST', url: '/ventas', payload: { metodoPago: 'digital', lineas: [{ productoId: a, cantidad: 4 }] } })
    await app.inject({ method: 'POST', url: '/bajas', payload: { productoId: a, cantidad: 2, motivo: 'otro' } })
    const v = (await app.inject({ method: 'GET', url: `/inventario/${a}/verificacion` })).json()
    expect(v).toEqual({ productoId: a, sumaMovimientos: 11, stockMostrado: 11, coinciden: true })
    const [fila] = (await app.inject({ method: 'GET', url: '/inventario' })).json()
    expect(fila.stock).toBe(v.stockMostrado)
  })
})
