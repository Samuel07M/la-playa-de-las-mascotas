import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cargarEnv, parsearEnv, rutasDeLaApp } from '../../main/env'
import { lineaDeRegistro, registroEnArchivo, type Registro } from '../registro'
import { iniciarBot } from '../telegram/bot'
import { nuevaDb } from './ayudas'

const USER_DATA = join('C:', 'Users', 'tienda', 'AppData', 'Roaming', 'La Playa de las Mascotas')
const APP_PATH = join('C:', 'repo', 'desktop')

describe('App instalada · ruta del .env y de los datos', () => {
  it('instalada: el .env y playa.db van en la carpeta de datos de la app (userData)', () => {
    const r = rutasDeLaApp({ empaquetada: true, userData: USER_DATA, appPath: join('C:', 'Program Files', 'app.asar') })
    expect(r).toEqual({ carpetaDatos: USER_DATA, env: join(USER_DATA, '.env') })
  })

  it('desarrollo: datos en desktop/dev-data y .env en la raíz del repositorio', () => {
    const r = rutasDeLaApp({ empaquetada: false, userData: USER_DATA, appPath: APP_PATH })
    expect(r).toEqual({ carpetaDatos: join(APP_PATH, 'dev-data'), env: join('C:', 'repo', '.env') })
  })

  it('si el .env no existe, no falla y avisa que no lo encontró', () => {
    expect(cargarEnv(join(tmpdir(), 'no-existe-' + Date.now(), '.env'))).toBe(false)
  })

  it('lee un .env guardado con BOM (como lo deja a veces el Bloc de notas)', () => {
    expect(parsearEnv('﻿TELEGRAM_BOT_TOKEN=abc\r\nTELEGRAM_CHATS_AUTORIZADOS=1,2\r\n')).toEqual({
      TELEGRAM_BOT_TOKEN: 'abc',
      TELEGRAM_CHATS_AUTORIZADOS: '1,2'
    })
  })

  it('la plantilla .env.ejemplo trae las dos variables sin valores reales', () => {
    const vars = parsearEnv(readFileSync(join(__dirname, '..', '..', '..', '..', '.env.ejemplo'), 'utf8'))
    expect(vars).toEqual({ TELEGRAM_BOT_TOKEN: '', TELEGRAM_CHATS_AUTORIZADOS: '' })
  })
})

describe('App instalada · registro del bot (telegram.log)', () => {
  it('cada línea lleva fecha, nivel, mensaje y el detalle del error', () => {
    const f = new Date('2026-11-14T18:30:00.000Z')
    expect(lineaDeRegistro('ERROR', 'Error de red', new Error('fetch failed'), f)).toBe(
      '2026-11-14T18:30:00.000Z [ERROR] Error de red — fetch failed'
    )
    expect(lineaDeRegistro('INFO', 'Chat operativo iniciado.', undefined, f)).toBe('2026-11-14T18:30:00.000Z [INFO] Chat operativo iniciado.')
  })

  it('escribe los avisos en el archivo (y crea la carpeta si falta)', () => {
    const ruta = join(mkdtempSync(join(tmpdir(), 'playa-')), 'datos', 'telegram.log')
    const r = registroEnArchivo(ruta)
    r.info('arrancó')
    r.aviso('sin token')
    const lineas = readFileSync(ruta, 'utf8').trim().split('\n')
    expect(lineas).toHaveLength(2)
    expect(lineas[0]).toMatch(/\[INFO\] arrancó$/)
    expect(lineas[1]).toMatch(/\[AVISO\] sin token$/)
  })

  it('un log grande se renombra a .1 al arrancar para que no crezca sin límite', () => {
    const ruta = join(mkdtempSync(join(tmpdir(), 'playa-')), 'telegram.log')
    writeFileSync(ruta, 'x'.repeat(1024 * 1024 + 1))
    registroEnArchivo(ruta).info('nuevo')
    expect(readFileSync(ruta + '.1', 'utf8').length).toBe(1024 * 1024 + 1)
    expect(readFileSync(ruta, 'utf8')).toMatch(/\[INFO\] nuevo\n$/)
  })

  it('sin token el bot no arranca, lo deja en el registro y la app sigue', () => {
    const avisos: string[] = []
    const registro: Registro = { info: () => {}, aviso: (m) => avisos.push(m), error: () => {} }
    expect(iniciarBot(nuevaDb(), {}, registro)).toBeNull()
    expect(avisos).toEqual(['No se encontró TELEGRAM_BOT_TOKEN en el .env; el chat operativo no se inicia.'])
  })
})
