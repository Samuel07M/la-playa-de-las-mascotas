import { describe, expect, it } from 'vitest'
import { nuevaDb } from './ayudas'
import { estaAutorizado, parsearChatsAutorizados, tecladoPrincipal } from '../telegram/logica'
import { ManejadorChat } from '../telegram/manejador'
import { BOTON_BAJA, BOTON_ENTRADA, BOTON_VENTA, NO_AUTORIZADO, SALUDO } from '../telegram/textos'
import { parsearEnv } from '../../main/env'

const ALIRIO = 111
const OLGA = 222
const AUTORIZADOS = [ALIRIO, OLGA]

const nuevoChat = () => new ManejadorChat(nuevaDb(), AUTORIZADOS)

describe('HU-10 · Acceder al chat móvil (Telegram)', () => {
  it('C1 y C2: al abrir el chat (/start) se da la bienvenida y se muestran los botones específicos', () => {
    const r = nuevoChat().procesar(ALIRIO, '/start', 'Alirio')
    expect(r[0].texto).toBe(SALUDO)
    // Un botón por fila, legibles, y solo los tres necesarios: nada innecesario.
    expect(r[0].teclado?.keyboard).toEqual([[{ text: BOTON_VENTA }], [{ text: BOTON_ENTRADA }], [{ text: BOTON_BAJA }]])
    expect(r[0].teclado?.resize_keyboard).toBe(true)
  })

  it('C2: el teclado principal tiene exactamente las tres acciones y ninguna más', () => {
    const botones = tecladoPrincipal().keyboard.flat().map((b) => b.text)
    expect(botones).toEqual([BOTON_VENTA, BOTON_ENTRADA, BOTON_BAJA])
  })

  it('C3: un chat no autorizado recibe un aviso y ningún teclado', () => {
    expect(estaAutorizado(ALIRIO, AUTORIZADOS)).toBe(true)
    expect(estaAutorizado(999, AUTORIZADOS)).toBe(false)
    const r = nuevoChat().procesar(999, '/start', 'Intruso')
    expect(r[0].texto).toBe(NO_AUTORIZADO)
    expect(r[0].teclado).toBeUndefined()
  })

  it('C3: sin chats autorizados configurados, nadie entra', () => {
    const r = new ManejadorChat(nuevaDb(), []).procesar(ALIRIO, '/start', 'Alirio')
    expect(r[0].texto).toBe(NO_AUTORIZADO)
  })

  it('un saludo simple de un autorizado abre el chat con botones', () => {
    const r = nuevoChat().procesar(OLGA, 'hola', 'Olga')
    expect(r[0].texto).toBe(SALUDO)
    expect(r[0].teclado?.keyboard).toHaveLength(3)
  })

  it('parsea la lista de chats autorizados del .env e ignora valores vacíos o inválidos', () => {
    expect(parsearChatsAutorizados('111, 222 ,333')).toEqual([111, 222, 333])
    expect(parsearChatsAutorizados('111,,abc, 0 ')).toEqual([111])
    expect(parsearChatsAutorizados(undefined)).toEqual([])
    expect(parsearChatsAutorizados('')).toEqual([])
  })

  it('el lector de .env toma clave/valor, ignora comentarios y quita comillas', () => {
    const vars = parsearEnv('# comentario\nTELEGRAM_BOT_TOKEN=abc123\nTELEGRAM_CHATS_AUTORIZADOS="111,222"\n\n')
    expect(vars).toEqual({ TELEGRAM_BOT_TOKEN: 'abc123', TELEGRAM_CHATS_AUTORIZADOS: '111,222' })
  })
})
