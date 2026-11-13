import { describe, expect, it } from 'vitest'
import { nuevaApi, productoCon } from './ayudas'
import { registrarVenta } from '../modules/ventas'
import { listarMovimientos } from '../modules/movimientos'

const valido = { nombre: 'Snack Dentastix', categoria: 'Snacks', precioVenta: 9500, stockMinimo: 10 }

describe('HU-01 · Gestionar catálogo de productos', () => {
  it('C1: crea un producto válido y aparece en el listado', async () => {
    const { app } = nuevaApi()
    const r = await app.inject({ method: 'POST', url: '/productos', payload: valido })
    expect(r.statusCode).toBe(201)
    expect(r.json()).toMatchObject({ ...valido, activo: true, stock: 0, alias: [] })
    const l = await app.inject({ method: 'GET', url: '/productos' })
    expect(l.json().map((p: { nombre: string }) => p.nombre)).toEqual(['Snack Dentastix'])
  })

  it.each([
    [{ ...valido, nombre: '  ' }, 'nombre', 'El nombre es obligatorio.'],
    [{ ...valido, nombre: undefined }, 'nombre', 'El nombre es obligatorio.'],
    [{ ...valido, categoria: '' }, 'categoria', 'Selecciona una categoría.'],
    [{ ...valido, categoria: 'Ropa' }, 'categoria', 'Selecciona una categoría.'],
    [{ ...valido, precioVenta: 0 }, 'precioVenta', 'El precio debe ser mayor que 0.'],
    [{ ...valido, precioVenta: -100 }, 'precioVenta', 'El precio debe ser mayor que 0.'],
    [{ ...valido, precioVenta: undefined }, 'precioVenta', 'El precio debe ser mayor que 0.'],
    [{ ...valido, stockMinimo: -1 }, 'stockMinimo', 'Indica un stock mínimo entero (0 o más).'],
    [{ ...valido, stockMinimo: 2.5 }, 'stockMinimo', 'Indica un stock mínimo entero (0 o más).'],
    [{ ...valido, stockMinimo: undefined }, 'stockMinimo', 'Indica un stock mínimo entero (0 o más).']
  ])('C2: rechaza %o e indica el campo', async (payload, campo, mensaje) => {
    const { app } = nuevaApi()
    const r = await app.inject({ method: 'POST', url: '/productos', payload })
    expect(r.statusCode).toBe(400)
    expect(r.json()).toEqual({ error: { campo, mensaje } })
    expect((await app.inject({ method: 'GET', url: '/productos' })).json()).toEqual([])
  })

  it('C2: la edición también valida', async () => {
    const { app, db } = nuevaApi()
    const id = productoCon(db)
    const r = await app.inject({ method: 'PUT', url: `/productos/${id}`, payload: { ...valido, precioVenta: 0 } })
    expect(r.json()).toEqual({ error: { campo: 'precioVenta', mensaje: 'El precio debe ser mayor que 0.' } })
  })

  it('C3: la edición se refleja de inmediato en el listado', async () => {
    const { app, db } = nuevaApi()
    const id = productoCon(db, 4)
    const r = await app.inject({
      method: 'PUT',
      url: `/productos/${id}`,
      payload: { nombre: 'Dog Chow 8kg', categoria: 'Alimento perros', precioVenta: 65000, stockMinimo: 6 }
    })
    expect(r.statusCode).toBe(200)
    const [p] = (await app.inject({ method: 'GET', url: '/productos' })).json()
    expect(p).toMatchObject({ nombre: 'Dog Chow 8kg', precioVenta: 65000, stockMinimo: 6, stock: 4 })
  })

  it('C3: la venta usa el precio vigente después de editar', async () => {
    const { app, db } = nuevaApi()
    const id = productoCon(db, 4, { precioVenta: 62000 })
    await app.inject({ method: 'PUT', url: `/productos/${id}`, payload: { ...valido, precioVenta: 70000 } })
    expect(registrarVenta(db, { metodoPago: 'efectivo', lineas: [{ productoId: id, cantidad: 1 }] }).total).toBe(70000)
  })

  it('C4: un producto desactivado no aparece en los selectores ni se puede vender, y conserva su historial', async () => {
    const { app, db } = nuevaApi()
    const id = productoCon(db, 4)
    const otro = productoCon(db, 2, { nombre: 'Arena sanitaria 10kg', categoria: 'Higiene' })
    const r = await app.inject({ method: 'PATCH', url: `/productos/${id}/activo`, payload: { activo: false } })
    expect(r.json()).toMatchObject({ activo: false, stock: 4 })

    const activos = (await app.inject({ method: 'GET', url: '/productos?activos=1' })).json()
    expect(activos.map((p: { id: number }) => p.id)).toEqual([otro])
    // En el catálogo sigue apareciendo (inactivo), con su historial.
    const todos = (await app.inject({ method: 'GET', url: '/productos' })).json()
    expect(todos).toHaveLength(2)
    expect(listarMovimientos(db, { productoId: id })).toHaveLength(1)

    expect(() =>
      registrarVenta(db, { metodoPago: 'efectivo', lineas: [{ productoId: id, cantidad: 1 }] })
    ).toThrow('Selecciona un producto existente.')

    const re = await app.inject({ method: 'PATCH', url: `/productos/${id}/activo`, payload: { activo: true } })
    expect(re.json().activo).toBe(true)
  })

  it('responde 404 si el producto no existe', async () => {
    const { app } = nuevaApi()
    const r = await app.inject({ method: 'PUT', url: '/productos/99', payload: valido })
    expect(r.statusCode).toBe(404)
    expect(r.json()).toEqual({ error: { mensaje: 'El producto no existe.' } })
  })
})
