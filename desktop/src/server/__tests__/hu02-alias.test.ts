import { describe, expect, it } from 'vitest'
import { nuevaApi, productoCon } from './ayudas'
import { listarMovimientos, stockDe } from '../modules/movimientos'

describe('HU-02 · Gestionar alias de productos', () => {
  it('C1: el alias queda asociado al producto', async () => {
    const { app, db } = nuevaApi()
    const id = productoCon(db)
    const r = await app.inject({ method: 'POST', url: `/productos/${id}/alias`, payload: { texto: '  dog chow ' } })
    expect(r.statusCode).toBe(201)
    expect(r.json()).toMatchObject({ texto: 'dog chow' })
    const [p] = (await app.inject({ method: 'GET', url: '/productos' })).json()
    expect(p.alias.map((a: { texto: string }) => a.texto)).toEqual(['dog chow'])
  })

  it('C1: un producto puede tener varios alias', async () => {
    const { app, db } = nuevaApi()
    const id = productoCon(db)
    await app.inject({ method: 'POST', url: `/productos/${id}/alias`, payload: { texto: 'dentastix' } })
    await app.inject({ method: 'POST', url: `/productos/${id}/alias`, payload: { texto: 'palitos' } })
    const [p] = (await app.inject({ method: 'GET', url: '/productos' })).json()
    expect(p.alias).toHaveLength(2)
  })

  it('rechaza un alias vacío', async () => {
    const { app, db } = nuevaApi()
    const id = productoCon(db)
    const r = await app.inject({ method: 'POST', url: `/productos/${id}/alias`, payload: { texto: '   ' } })
    expect(r.statusCode).toBe(400)
    expect(r.json()).toEqual({ error: { campo: 'texto', mensaje: 'Escribe un alias.' } })
  })

  it('C2: rechaza un alias de otro producto (sin distinguir mayúsculas) e indica a cuál pertenece', async () => {
    const { app, db } = nuevaApi()
    const chow = productoCon(db, 0, { nombre: 'Concentrado Dog Chow Adulto 8kg' })
    const gatsy = productoCon(db, 0, { nombre: 'Concentrado Gatsy Gatos 3kg', categoria: 'Alimento gatos' })
    await app.inject({ method: 'POST', url: `/productos/${chow}/alias`, payload: { texto: 'chow' } })
    const r = await app.inject({ method: 'POST', url: `/productos/${gatsy}/alias`, payload: { texto: 'CHOW' } })
    expect(r.statusCode).toBe(409)
    expect(r.json()).toEqual({
      error: { campo: 'texto', mensaje: 'Ese alias ya pertenece a «Concentrado Dog Chow Adulto 8kg».' }
    })
    // La BD también lo impide.
    expect(() =>
      db.prepare(`INSERT INTO alias (producto_id, texto, texto_normalizado) VALUES (?, 'Chow', 'chow')`).run(gatsy)
    ).toThrow(/UNIQUE/)
  })

  it('C3: quitar un alias no afecta al producto ni a su historial', async () => {
    const { app, db } = nuevaApi()
    const id = productoCon(db, 7)
    const a = (await app.inject({ method: 'POST', url: `/productos/${id}/alias`, payload: { texto: 'arena' } })).json()
    const antes = listarMovimientos(db, { productoId: id })
    const r = await app.inject({ method: 'DELETE', url: `/alias/${a.id}` })
    expect(r.statusCode).toBe(204)
    const [p] = (await app.inject({ method: 'GET', url: '/productos' })).json()
    expect(p).toMatchObject({ id, activo: true, alias: [], stock: 7 })
    expect(listarMovimientos(db, { productoId: id })).toEqual(antes)
    expect(stockDe(db, id)).toBe(7)
    // El alias liberado se puede volver a usar.
    const otra = await app.inject({ method: 'POST', url: `/productos/${id}/alias`, payload: { texto: 'Arena' } })
    expect(otra.statusCode).toBe(201)
  })

  it('C4: la búsqueda encuentra el producto por su alias e indica cuál coincidió', async () => {
    const { app, db } = nuevaApi()
    const id = productoCon(db, 0, { nombre: 'Snack Dentastix', categoria: 'Snacks' })
    productoCon(db, 0, { nombre: 'Arena sanitaria 10kg', categoria: 'Higiene' })
    await app.inject({ method: 'POST', url: `/productos/${id}/alias`, payload: { texto: 'palitos' } })
    const r = (await app.inject({ method: 'GET', url: '/productos?q=PALI' })).json()
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ id, aliasCoincidente: 'palitos' })
    // Si coincide por nombre o categoría no se marca alias.
    const n = (await app.inject({ method: 'GET', url: '/productos?q=higiene' })).json()
    expect(n.map((p: { nombre: string }) => p.nombre)).toEqual(['Arena sanitaria 10kg'])
    expect(n[0].aliasCoincidente).toBeNull()
  })

  it('404 al quitar un alias que no existe', async () => {
    const { app } = nuevaApi()
    const r = await app.inject({ method: 'DELETE', url: '/alias/5' })
    expect(r.statusCode).toBe(404)
  })
})
