import { describe, expect, it } from 'vitest'
import { nuevaDb, productoCon } from './ayudas'
import { agregarAlias } from '../modules/alias'
import { stockDe } from '../modules/movimientos'
import { listarBajas } from '../modules/bajas'
import { entradasRecientes } from '../modules/entradas'
import { listarNoEntendidos } from '../modules/mensajes'
import { ManejadorChat } from '../telegram/manejador'
import {
  BOTON_BAJA,
  BOTON_CANCELAR,
  BOTON_CONFIRMAR,
  BOTON_ENTRADA,
  BOTON_VENCIDO
} from '../telegram/textos'

const CHAT = 111
const AUTORIZADOS = [CHAT]

function tienda() {
  const db = nuevaDb()
  const chow = productoCon(db, 10, { nombre: 'Concentrado Dog Chow Adulto 8kg', precioVenta: 62000 })
  const arena = productoCon(db, 10, { nombre: 'Arena para gato', categoria: 'Higiene', precioVenta: 15000 })
  agregarAlias(db, chow, 'dog chow')
  agregarAlias(db, arena, 'arena')
  return { db, chow, arena }
}

describe('HU-12 · Registrar entradas por mensaje', () => {
  it('C1 y C3: entrada con referencia muestra resumen, pide confirmar y al confirmar suma stock', () => {
    const { db, chow, arena } = tienda()
    const chat = new ManejadorChat(db, AUTORIZADOS)
    chat.procesar(CHAT, BOTON_ENTRADA, 'Alirio')
    const resumen = chat.procesar(CHAT, '5 dog chow y 3 arena', 'Alirio')
    const textoResumen = resumen.map((x) => x.texto).join('\n')
    expect(textoResumen).toContain('Resumen de la entrada')
    expect(textoResumen).toContain('5 × Concentrado Dog Chow Adulto 8kg')
    expect(textoResumen).toContain('referencia') // pide la referencia
    chat.procesar(CHAT, 'FAC-1023', 'Alirio')
    const ok = chat.procesar(CHAT, BOTON_CONFIRMAR, 'Alirio')
    expect(ok.map((x) => x.texto).join('\n')).toContain('Entrada registrada')
    expect(stockDe(db, chow)).toBe(15)
    expect(stockDe(db, arena)).toBe(13)
    // La referencia escrita quedó en la entrada.
    const recientes = entradasRecientes(db)
    expect(recientes[0].referencia).toBe('FAC-1023')
  })

  it('cancelar la entrada no modifica el stock', () => {
    const { db, chow } = tienda()
    const chat = new ManejadorChat(db, AUTORIZADOS)
    chat.procesar(CHAT, BOTON_ENTRADA, 'Olga')
    chat.procesar(CHAT, '5 dog chow', 'Olga')
    chat.procesar(CHAT, BOTON_CANCELAR, 'Olga')
    expect(stockDe(db, chow)).toBe(10)
  })

  it('referencia vacía: se vuelve a pedir y no se registra todavía', () => {
    const { db, chow } = tienda()
    const chat = new ManejadorChat(db, AUTORIZADOS)
    chat.procesar(CHAT, BOTON_ENTRADA, 'Alirio')
    chat.procesar(CHAT, '5 dog chow', 'Alirio')
    const r = chat.procesar(CHAT, '   ', 'Alirio')
    expect(r.map((x) => x.texto).join('\n')).toContain('no puede estar vacía')
    expect(stockDe(db, chow)).toBe(10)
  })
})

describe('HU-12 · Registrar bajas por mensaje', () => {
  it('C2 y C3: baja sin motivo pide el motivo (botones) y al confirmar descuenta stock', () => {
    const { db, chow } = tienda()
    const chat = new ManejadorChat(db, AUTORIZADOS)
    chat.procesar(CHAT, BOTON_BAJA, 'Alirio')
    const resumen = chat.procesar(CHAT, '2 dog chow', 'Alirio')
    const texto = resumen.map((x) => x.texto).join('\n')
    expect(texto).toContain('Resumen de la baja')
    expect(texto).toContain('Por qué das de baja') // pide el motivo
    chat.procesar(CHAT, BOTON_VENCIDO, 'Alirio')
    const ok = chat.procesar(CHAT, BOTON_CONFIRMAR, 'Alirio')
    expect(ok.map((x) => x.texto).join('\n')).toContain('Baja registrada')
    expect(stockDe(db, chow)).toBe(8)
    const bajas = listarBajas(db)
    expect(bajas).toHaveLength(1)
    expect(bajas[0]).toMatchObject({ motivo: 'vencido', cantidad: 2 })
  })

  it('baja de varios productos con un solo motivo (punto 2 acordado)', () => {
    const { db, chow, arena } = tienda()
    const chat = new ManejadorChat(db, AUTORIZADOS)
    chat.procesar(CHAT, BOTON_BAJA, 'Olga')
    chat.procesar(CHAT, '2 dog chow y 1 arena', 'Olga')
    chat.procesar(CHAT, BOTON_VENCIDO, 'Olga')
    chat.procesar(CHAT, BOTON_CONFIRMAR, 'Olga')
    expect(stockDe(db, chow)).toBe(8)
    expect(stockDe(db, arena)).toBe(9)
    expect(listarBajas(db)).toHaveLength(2)
  })

  it('C/punto 4: baja que supera el stock se RECHAZA y no registra ninguna línea', () => {
    const { db, chow, arena } = tienda() // ambos con stock 10
    const chat = new ManejadorChat(db, AUTORIZADOS)
    chat.procesar(CHAT, BOTON_BAJA, 'Alirio')
    chat.procesar(CHAT, '2 dog chow y 15 arena', 'Alirio') // arena supera el stock
    chat.procesar(CHAT, BOTON_VENCIDO, 'Alirio')
    const r = chat.procesar(CHAT, BOTON_CONFIRMAR, 'Alirio')
    expect(r.map((x) => x.texto).join('\n')).toContain('supera el stock')
    // Ninguna baja se registró, ni siquiera la de dog chow que sí cabía.
    expect(stockDe(db, chow)).toBe(10)
    expect(stockDe(db, arena)).toBe(10)
    expect(listarBajas(db)).toHaveLength(0)
  })

  it('cancelar la baja no modifica el stock', () => {
    const { db, chow } = tienda()
    const chat = new ManejadorChat(db, AUTORIZADOS)
    chat.procesar(CHAT, BOTON_BAJA, 'Olga')
    chat.procesar(CHAT, '2 dog chow', 'Olga')
    chat.procesar(CHAT, BOTON_VENCIDO, 'Olga')
    chat.procesar(CHAT, BOTON_CANCELAR, 'Olga')
    expect(stockDe(db, chow)).toBe(10)
  })
})

describe('HU-12 · Mensaje no entendido (punto 5)', () => {
  it('entrada: un mensaje sin patrón se guarda como pendiente y no registra nada', () => {
    const { db } = tienda()
    const chat = new ManejadorChat(db, AUTORIZADOS)
    chat.procesar(CHAT, BOTON_ENTRADA, 'Alirio')
    const r = chat.procesar(CHAT, 'llegaron unas cosas', 'Alirio')
    expect(r.map((x) => x.texto).join('\n')).toContain('revise')
    expect(listarNoEntendidos(db, true)).toHaveLength(1)
    expect(entradasRecientes(db)).toHaveLength(0)
  })

  it('baja: producto no reconocido va a pendientes', () => {
    const { db } = tienda()
    const chat = new ManejadorChat(db, AUTORIZADOS)
    chat.procesar(CHAT, BOTON_BAJA, 'Olga')
    chat.procesar(CHAT, '1 producto inexistente', 'Olga')
    expect(listarNoEntendidos(db, true)).toHaveLength(1)
    expect(listarBajas(db)).toHaveLength(0)
  })
})
