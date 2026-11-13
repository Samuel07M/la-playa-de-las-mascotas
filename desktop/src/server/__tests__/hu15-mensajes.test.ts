import { describe, expect, it } from 'vitest'
import { nuevaApi, productoCon } from './ayudas'
import { registrarMensaje } from '../modules/mensajes'
import { duenoDelAlias } from '../modules/alias'
import { seed } from '../db/seed'

describe('HU-15 · Revisar mensajes no entendidos', () => {
  it('C1: lista los mensajes no entendidos con texto, usuario y fecha', async () => {
    const { app, db } = nuevaApi()
    registrarMensaje(db, { texto: 'vendi 2 chow pequeño', usuario: 'Alirio', estado: 'no_entendido', fecha: '2026-11-11T15:00:00.000Z' })
    registrarMensaje(db, { texto: 'vendí 1 arena', usuario: 'Olga', estado: 'confirmado', fecha: '2026-11-11T16:00:00.000Z' })
    registrarMensaje(db, { texto: 'se rompio un platico', usuario: 'Olga', estado: 'no_entendido', fecha: '2026-11-12T15:00:00.000Z' })
    const r = (await app.inject({ method: 'GET', url: '/mensajes?pendientes=1' })).json()
    expect(r.map((m: { texto: string; usuario: string; fecha: string }) => [m.texto, m.usuario, m.fecha])).toEqual([
      ['se rompio un platico', 'Olga', '2026-11-12T15:00:00.000Z'],
      ['vendi 2 chow pequeño', 'Alirio', '2026-11-11T15:00:00.000Z']
    ])
  })

  it('C2 y C3: el texto asociado a un producto queda como alias y desde entonces se reconoce', async () => {
    const { app, db } = nuevaApi()
    const p = productoCon(db, 5, { nombre: 'Plato de acero inoxidable', categoria: 'Accesorios' })
    const id = registrarMensaje(db, { texto: 'platico', usuario: 'Alirio', estado: 'no_entendido' })
    const r = await app.inject({ method: 'POST', url: `/mensajes/${id}/alias`, payload: { productoId: p, texto: '  platico ' } })
    expect(r.statusCode).toBe(201)
    expect(r.json()).toMatchObject({ productoId: p, producto: 'Plato de acero inoxidable', aliasTexto: 'platico', revisado: false })
    // El mismo texto ahora lo reconoce el sistema (sin distinguir mayúsculas), igual que lo usará el chat.
    expect(duenoDelAlias(db, 'PLATICO')).toBe('Plato de acero inoxidable')
    const busqueda = (await app.inject({ method: 'GET', url: '/productos?q=Platico' })).json()
    expect(busqueda).toEqual([expect.objectContaining({ id: p, aliasCoincidente: 'platico' })])
  })

  it('C2: aplica las reglas de alias: único y obligatorio', async () => {
    const { app, db } = nuevaApi()
    const a = productoCon(db, 0, { nombre: 'Concentrado Dog Chow Adulto 8kg' })
    const b = productoCon(db, 0, { nombre: 'Snack Dentastix' })
    await app.inject({ method: 'POST', url: `/productos/${a}/alias`, payload: { texto: 'chow' } })
    const id = registrarMensaje(db, { texto: 'Chow', usuario: 'Olga', estado: 'no_entendido' })
    const dup = await app.inject({ method: 'POST', url: `/mensajes/${id}/alias`, payload: { productoId: b, texto: 'CHOW' } })
    expect(dup.statusCode).toBe(409)
    expect(dup.json().error.mensaje).toBe('Ese alias ya pertenece a «Concentrado Dog Chow Adulto 8kg».')
    const vacio = await app.inject({ method: 'POST', url: `/mensajes/${id}/alias`, payload: { productoId: b, texto: ' ' } })
    expect(vacio.json().error).toEqual({ campo: 'texto', mensaje: 'Escribe un alias.' })
    expect((await app.inject({ method: 'POST', url: '/mensajes/999/alias', payload: { productoId: b, texto: 'x' } })).statusCode).toBe(404)
  })

  it('C4: al marcarlo como revisado deja de aparecer en la lista pendiente (sin borrarse)', async () => {
    const { app, db } = nuevaApi()
    const id = registrarMensaje(db, { texto: 'pedigri', usuario: 'Olga', estado: 'no_entendido' })
    const r = await app.inject({ method: 'PATCH', url: `/mensajes/${id}/revisado` })
    expect(r.json()).toMatchObject({ id, revisado: true })
    expect((await app.inject({ method: 'GET', url: '/mensajes?pendientes=1' })).json()).toEqual([])
    expect((await app.inject({ method: 'GET', url: '/mensajes' })).json()).toHaveLength(1)
    expect(() => db.prepare('DELETE FROM mensajes').run()).toThrow(/no se borran/)
  })

  it('el seed de demostración trae 3 mensajes pendientes', async () => {
    const { app, db } = nuevaApi()
    seed(db)
    expect((await app.inject({ method: 'GET', url: '/mensajes?pendientes=1' })).json()).toHaveLength(3)
    expect((await app.inject({ method: 'GET', url: '/proveedores' })).json()).toHaveLength(3)
  })
})
