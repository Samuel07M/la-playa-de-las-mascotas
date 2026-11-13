import { describe, expect, it } from 'vitest'
import { abrirBaseDeDatos } from '../db/connection'
import { crearApp } from '../app'

describe('API', () => {
  it('GET /salud responde', async () => {
    const app = crearApp(abrirBaseDeDatos(':memory:'))
    const r = await app.inject({ method: 'GET', url: '/salud' })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ ok: true, db: true })
  })
})
