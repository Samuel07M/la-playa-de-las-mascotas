import { describe, expect, it } from 'vitest'
import {
  decidirRespuesta,
  estaAutorizado,
  parsearChatsAutorizados,
  tecladoPrincipal
} from '../telegram/logica'
import {
  ACCION_PROXIMAMENTE,
  BOTON_BAJA,
  BOTON_ENTRADA,
  BOTON_VENTA,
  NO_AUTORIZADO,
  SALUDO
} from '../telegram/textos'
import { parsearEnv } from '../../main/env'

const ALIRIO = 111
const OLGA = 222
const AUTORIZADOS = [ALIRIO, OLGA]

describe('HU-10 · Acceder al chat móvil (Telegram)', () => {
  it('C1 y C2: al abrir el chat (/start) se da la bienvenida y se muestran los botones específicos', () => {
    const r = decidirRespuesta({ chatId: ALIRIO, texto: '/start' }, AUTORIZADOS)
    expect(r.texto).toBe(SALUDO)
    // Un botón por fila, legibles, y solo los tres necesarios: nada innecesario.
    expect(r.teclado?.keyboard).toEqual([[{ text: BOTON_VENTA }], [{ text: BOTON_ENTRADA }], [{ text: BOTON_BAJA }]])
    expect(r.teclado?.resize_keyboard).toBe(true)
  })

  it('C2: el teclado tiene exactamente las tres acciones y ninguna más', () => {
    const botones = tecladoPrincipal().keyboard.flat().map((b) => b.text)
    expect(botones).toEqual([BOTON_VENTA, BOTON_ENTRADA, BOTON_BAJA])
  })

  it('C2: tocar un botón de acción responde y mantiene el teclado visible', () => {
    const r = decidirRespuesta({ chatId: OLGA, texto: BOTON_VENTA }, AUTORIZADOS)
    expect(r.texto).toBe(ACCION_PROXIMAMENTE)
    expect(r.teclado?.keyboard).toHaveLength(3)
  })

  it('C3: solo los chats autorizados (Alirio y Olga) usan el chat; cualquier otro recibe un aviso y ningún teclado', () => {
    expect(estaAutorizado(ALIRIO, AUTORIZADOS)).toBe(true)
    expect(estaAutorizado(999, AUTORIZADOS)).toBe(false)
    const r = decidirRespuesta({ chatId: 999, texto: '/start' }, AUTORIZADOS)
    expect(r.texto).toBe(NO_AUTORIZADO)
    expect(r.teclado).toBeUndefined()
  })

  it('C3: sin chats autorizados configurados, nadie entra', () => {
    const r = decidirRespuesta({ chatId: ALIRIO, texto: '/start' }, [])
    expect(r.texto).toBe(NO_AUTORIZADO)
  })

  it('cualquier texto suelto de un autorizado también abre el chat con botones', () => {
    const r = decidirRespuesta({ chatId: OLGA, texto: 'hola' }, AUTORIZADOS)
    expect(r.texto).toBe(SALUDO)
    expect(r.teclado?.keyboard).toHaveLength(3)
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
