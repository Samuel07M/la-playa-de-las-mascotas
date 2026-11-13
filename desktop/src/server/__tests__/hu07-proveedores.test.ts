import { describe, expect, it } from 'vitest'
import { nuevaApi, productoCon } from './ayudas'

describe('HU-07 · Proveedores e historial de precios', () => {
  it('C1: crea un proveedor con nombre y contacto y lo puede editar', async () => {
    const { app } = nuevaApi()
    const c = await app.inject({
      method: 'POST',
      url: '/proveedores',
      payload: { nombre: '  Distrimascotas  ', telefono: '602 555 0142', correo: 'pedidos@distri.example' }
    })
    expect(c.statusCode).toBe(201)
    const p = c.json()
    expect(p).toMatchObject({ nombre: 'Distrimascotas', telefono: '602 555 0142', correo: 'pedidos@distri.example', activo: true })
    const e = await app.inject({ method: 'PUT', url: `/proveedores/${p.id}`, payload: { nombre: 'Distrimascotas S.A.S.', telefono: '', correo: '' } })
    expect(e.json()).toMatchObject({ id: p.id, nombre: 'Distrimascotas S.A.S.', telefono: null, correo: null })
    expect((await app.inject({ method: 'GET', url: '/proveedores' })).json()).toHaveLength(1)
  })

  it('C1: valida nombre y correo en la API', async () => {
    const { app } = nuevaApi()
    const a = await app.inject({ method: 'POST', url: '/proveedores', payload: { nombre: '  ' } })
    expect(a.statusCode).toBe(400)
    expect(a.json()).toEqual({ error: { campo: 'nombre', mensaje: 'El nombre es obligatorio.' } })
    const b = await app.inject({ method: 'POST', url: '/proveedores', payload: { nombre: 'X', correo: 'no-es-correo' } })
    expect(b.json()).toEqual({ error: { campo: 'correo', mensaje: 'Escribe un correo válido.' } })
  })

  it('C2: registra un precio de compra con su fecha en el historial', async () => {
    const { app, db } = nuevaApi()
    const prod = productoCon(db)
    const pv = (await app.inject({ method: 'POST', url: '/proveedores', payload: { nombre: 'Granja' } })).json()
    const r = await app.inject({
      method: 'POST',
      url: `/proveedores/${pv.id}/precios`,
      payload: { productoId: prod, precio: 48000, fecha: '2026-11-01' }
    })
    expect(r.statusCode).toBe(201)
    expect(r.json()).toMatchObject({ proveedor: 'Granja', productoId: prod, precio: 48000, fecha: '2026-11-01' })
    const lista = (await app.inject({ method: 'GET', url: '/proveedores' })).json()
    expect(lista[0].precios).toBe(1)
  })

  it('C2: rechaza precio ≤ 0, decimales, fecha inválida, producto inexistente y proveedor inactivo', async () => {
    const { app, db } = nuevaApi()
    const prod = productoCon(db)
    const pv = (await app.inject({ method: 'POST', url: '/proveedores', payload: { nombre: 'Granja' } })).json()
    const enviar = (payload: object, id = pv.id) => app.inject({ method: 'POST', url: `/proveedores/${id}/precios`, payload })
    expect((await enviar({ productoId: prod, precio: 0, fecha: '2026-11-01' })).json().error).toEqual({ campo: 'precio', mensaje: 'El precio debe ser mayor que 0.' })
    expect((await enviar({ productoId: prod, precio: 10.5, fecha: '2026-11-01' })).statusCode).toBe(400)
    expect((await enviar({ productoId: prod, precio: 100, fecha: '2026-02-30' })).json().error).toEqual({ campo: 'fecha', mensaje: 'Selecciona una fecha.' })
    expect((await enviar({ productoId: 999, precio: 100, fecha: '2026-11-01' })).json().error.campo).toBe('productoId')
    await app.inject({ method: 'PATCH', url: `/proveedores/${pv.id}/activo`, payload: { activo: false } })
    expect((await enviar({ productoId: prod, precio: 100, fecha: '2026-11-01' })).json().error.mensaje).toBe('Selecciona un proveedor activo.')
    expect((await enviar({ productoId: prod, precio: 100, fecha: '2026-11-01' }, 999)).statusCode).toBe(404)
  })

  it('C3: muestra la evolución del precio de un producto por proveedor', async () => {
    const { app, db } = nuevaApi()
    const prod = productoCon(db)
    const otro = productoCon(db, 0, { nombre: 'Snack Dentastix' })
    const a = (await app.inject({ method: 'POST', url: '/proveedores', payload: { nombre: 'Bodega Sur' } })).json()
    const b = (await app.inject({ method: 'POST', url: '/proveedores', payload: { nombre: 'Agro Norte' } })).json()
    const precio = (pv: number, productoId: number, precio: number, fecha: string) =>
      app.inject({ method: 'POST', url: `/proveedores/${pv}/precios`, payload: { productoId, precio, fecha } })
    await precio(a.id, prod, 51000, '2026-11-10')
    await precio(a.id, prod, 48000, '2026-09-01')
    await precio(b.id, prod, 50000, '2026-10-01')
    await precio(b.id, otro, 6000, '2026-10-01')
    const r = (await app.inject({ method: 'GET', url: `/productos/${prod}/precios` })).json()
    expect(r.map((x: { proveedor: string; precio: number; fecha: string }) => [x.proveedor, x.precio, x.fecha])).toEqual([
      ['Agro Norte', 50000, '2026-10-01'],
      ['Bodega Sur', 48000, '2026-09-01'],
      ['Bodega Sur', 51000, '2026-11-10']
    ])
    expect((await app.inject({ method: 'GET', url: '/productos/999/precios' })).statusCode).toBe(404)
  })

  it('C4: un proveedor con precios no se elimina: solo se desactiva y conserva su historial', async () => {
    const { app, db } = nuevaApi()
    const prod = productoCon(db)
    const pv = (await app.inject({ method: 'POST', url: '/proveedores', payload: { nombre: 'Granja' } })).json()
    await app.inject({ method: 'POST', url: `/proveedores/${pv.id}/precios`, payload: { productoId: prod, precio: 1000, fecha: '2026-11-01' } })
    const d = await app.inject({ method: 'DELETE', url: `/proveedores/${pv.id}` })
    expect(d.statusCode).toBe(409)
    expect(d.json().error.mensaje).toBe('Los proveedores no se eliminan: solo se pueden desactivar.')
    expect(() => db.prepare('DELETE FROM proveedores WHERE id = ?').run(pv.id)).toThrow(/se desactivan/)
    expect(() => db.prepare('DELETE FROM precios_proveedor').run()).toThrow(/no se borran/)
    expect(() => db.prepare('UPDATE precios_proveedor SET precio = 1').run()).toThrow(/no se editan/)
    const off = await app.inject({ method: 'PATCH', url: `/proveedores/${pv.id}/activo`, payload: { activo: false } })
    expect(off.json()).toMatchObject({ activo: false, precios: 1 })
    expect((await app.inject({ method: 'GET', url: '/proveedores?activos=1' })).json()).toEqual([])
    expect((await app.inject({ method: 'GET', url: `/productos/${prod}/precios` })).json()).toHaveLength(1)
  })
})
