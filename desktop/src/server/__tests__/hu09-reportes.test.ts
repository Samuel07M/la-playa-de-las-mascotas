import { describe, expect, it } from 'vitest'
import { nuevaApi, productoCon } from './ayudas'
import { registrarVenta } from '../modules/ventas'
import { registrarEntrada } from '../modules/entradas'
import { clasificar } from '../modules/reportes'
import { crearProveedor, registrarPrecio } from '../modules/proveedores'

const RANGO = 'desde=2026-11-01&hasta=2026-11-30'
const EN_RANGO = '2026-11-10T15:00:00.000Z'

describe('HU-09 · Reportes', () => {
  it('C1: el 100 % de los productos activos queda clasificado en alta, media o baja (por tercios)', async () => {
    const { app, db } = nuevaApi()
    // 6 activos con ventas 9, 7, 5, 3, 1, 0 → alta, alta, media, media, baja, baja. Uno inactivo no aparece.
    const ventas = [9, 7, 5, 3, 1, 0]
    const ids = ventas.map((_, i) => productoCon(db, 20, { nombre: `Producto ${i + 1}` }))
    ventas.forEach((q, i) => q && registrarVenta(db, { metodoPago: 'efectivo', lineas: [{ productoId: ids[i], cantidad: q }] }, { fecha: EN_RANGO }))
    const inactivo = productoCon(db, 5, { nombre: 'Juguete' })
    await app.inject({ method: 'PATCH', url: `/productos/${inactivo}/activo`, payload: { activo: false } })
    // Venta fuera del periodo: no cuenta.
    registrarVenta(db, { metodoPago: 'efectivo', lineas: [{ productoId: ids[5], cantidad: 10 }] }, { fecha: '2026-10-31T15:00:00.000Z' })
    const r = (await app.inject({ method: 'GET', url: `/reportes/rotacion?${RANGO}` })).json()
    expect(r.map((x: { nombre: string; vendidas: number; rotacion: string }) => [x.nombre, x.vendidas, x.rotacion])).toEqual([
      ['Producto 1', 9, 'alta'],
      ['Producto 2', 7, 'alta'],
      ['Producto 3', 5, 'media'],
      ['Producto 4', 3, 'media'],
      ['Producto 5', 1, 'baja'],
      ['Producto 6', 0, 'baja']
    ])
    expect(r[0]).toMatchObject({ categoria: 'Alimento perros', stock: 11 })
  })

  it('C1: los empates quedan en la misma clase y quien no vende es siempre baja', () => {
    expect(clasificar(5, 0, 3)).toBe('alta')
    expect(clasificar(5, 0, 1)).toBe('alta')
    expect(clasificar(0, 0, 3)).toBe('baja')
    // 4 productos: 4, 2, 2, 1 → el segundo y tercero empatan en la posición 1 (alta: posiciones < 2).
    expect([clasificar(4, 0, 4), clasificar(2, 1, 4), clasificar(2, 1, 4), clasificar(1, 3, 4)]).toEqual(['alta', 'alta', 'alta', 'baja'])
  })

  it('C2: top de productos más vendidos en el rango, ordenado por cantidad', async () => {
    const { app, db } = nuevaApi()
    const a = productoCon(db, 50, { nombre: 'Arena', precioVenta: 24000 })
    const b = productoCon(db, 50, { nombre: 'Dentastix', precioVenta: 9500 })
    const c = productoCon(db, 50, { nombre: 'Collar', precioVenta: 18000 })
    registrarVenta(db, { metodoPago: 'efectivo', lineas: [{ productoId: a, cantidad: 2 }, { productoId: b, cantidad: 5 }] }, { fecha: EN_RANGO })
    registrarVenta(db, { metodoPago: 'digital', lineas: [{ productoId: b, cantidad: 1 }, { productoId: c, cantidad: 3 }] }, { fecha: EN_RANGO })
    registrarVenta(db, { metodoPago: 'digital', lineas: [{ productoId: a, cantidad: 20 }] }, { fecha: '2026-12-01T15:00:00.000Z' })
    const r = (await app.inject({ method: 'GET', url: `/reportes/top-productos?${RANGO}` })).json()
    expect(r).toEqual([
      { id: b, nombre: 'Dentastix', cantidad: 6, valor: 57000 },
      { id: c, nombre: 'Collar', cantidad: 3, valor: 54000 },
      { id: a, nombre: 'Arena', cantidad: 2, valor: 48000 }
    ])
  })

  it('C2: muestra como máximo 10 productos', async () => {
    const { app, db } = nuevaApi()
    for (let i = 1; i <= 12; i++) {
      const id = productoCon(db, 20, { nombre: `P${String(i).padStart(2, '0')}` })
      registrarVenta(db, { metodoPago: 'efectivo', lineas: [{ productoId: id, cantidad: i }] }, { fecha: EN_RANGO })
    }
    const r = (await app.inject({ method: 'GET', url: `/reportes/top-productos?${RANGO}` })).json()
    expect(r).toHaveLength(10)
    expect(r[0].nombre).toBe('P12')
  })

  it('C3: principales proveedores por valor comprado (entradas con proveedor × precio vigente)', async () => {
    const { app, db } = nuevaApi()
    const chow = productoCon(db, 0, { nombre: 'Dog Chow' })
    const arena = productoCon(db, 0, { nombre: 'Arena' })
    const granja = crearProveedor(db, { nombre: 'Granja', telefono: null, correo: null }).id
    const distri = crearProveedor(db, { nombre: 'Distri', telefono: null, correo: null }).id
    crearProveedor(db, { nombre: 'Sin compras', telefono: null, correo: null })
    registrarPrecio(db, granja, { productoId: chow, precio: 48000, fecha: '2026-11-01' })
    registrarPrecio(db, granja, { productoId: chow, precio: 51000, fecha: '2026-11-15' })
    registrarPrecio(db, distri, { productoId: arena, precio: 17000, fecha: '2026-11-20' })
    // Granja: 2 chow el 10 nov (48.000) + 1 chow el 20 nov (51.000) = 147.000
    registrarEntrada(db, { referencia: 'FAC-1', proveedorId: granja, lineas: [{ productoId: chow, cantidad: 2 }] }, EN_RANGO)
    registrarEntrada(db, { referencia: 'FAC-2', proveedorId: granja, lineas: [{ productoId: chow, cantidad: 1 }] }, '2026-11-20T15:00:00.000Z')
    // Distri: 10 arenas el 10 nov, antes de su primer precio → se valora con el primero (17.000) = 170.000
    registrarEntrada(db, { referencia: 'REM-7', proveedorId: distri, lineas: [{ productoId: arena, cantidad: 10 }] }, EN_RANGO)
    // Sin proveedor y fuera de rango: no cuentan.
    registrarEntrada(db, { referencia: 'FAC-3', lineas: [{ productoId: arena, cantidad: 50 }] }, EN_RANGO)
    registrarEntrada(db, { referencia: 'FAC-4', proveedorId: granja, lineas: [{ productoId: chow, cantidad: 50 }] }, '2026-12-02T15:00:00.000Z')
    const r = (await app.inject({ method: 'GET', url: `/reportes/proveedores?${RANGO}` })).json()
    expect(r).toEqual([
      { id: distri, nombre: 'Distri', entradas: 1, unidades: 10, valor: 170000 },
      { id: granja, nombre: 'Granja', entradas: 2, unidades: 3, valor: 147000 }
    ])
  })

  it('C3: la entrada guarda el proveedor y rechaza uno inactivo', async () => {
    const { app, db } = nuevaApi()
    const p = productoCon(db)
    const pv = crearProveedor(db, { nombre: 'Granja', telefono: null, correo: null }).id
    const ok = await app.inject({ method: 'POST', url: '/entradas', payload: { referencia: 'F1', proveedorId: pv, lineas: [{ productoId: p, cantidad: 1 }] } })
    expect(ok.statusCode).toBe(201)
    expect(db.prepare('SELECT proveedor_id AS v FROM movimientos').get()).toEqual({ v: pv })
    await app.inject({ method: 'PATCH', url: `/proveedores/${pv}/activo`, payload: { activo: false } })
    const no = await app.inject({ method: 'POST', url: '/entradas', payload: { referencia: 'F2', proveedorId: pv, lineas: [{ productoId: p, cantidad: 1 }] } })
    expect(no.json().error).toEqual({ campo: 'proveedorId', mensaje: 'Selecciona un proveedor activo.' })
    const sin = await app.inject({ method: 'POST', url: '/entradas', payload: { referencia: 'F3', proveedorId: null, lineas: [{ productoId: p, cantidad: 1 }] } })
    expect(sin.statusCode).toBe(201)
  })

  it('C4: sin datos en el periodo los reportes vienen vacíos (la pantalla muestra un mensaje)', async () => {
    const { app, db } = nuevaApi()
    productoCon(db, 10)
    for (const r of ['rotacion', 'top-productos', 'proveedores']) {
      const x = await app.inject({ method: 'GET', url: `/reportes/${r}?${RANGO}` })
      expect(x.statusCode).toBe(200)
      expect(x.json()).toEqual([])
    }
  })

  it('valida el rango de fechas', async () => {
    const { app } = nuevaApi()
    const r = await app.inject({ method: 'GET', url: '/reportes/rotacion?desde=2026-11-30&hasta=2026-11-01' })
    expect(r.json().error).toEqual({ campo: 'desde', mensaje: 'La fecha inicial no puede ser posterior a la final.' })
    expect((await app.inject({ method: 'GET', url: '/reportes/top-productos' })).statusCode).toBe(400)
  })
})
