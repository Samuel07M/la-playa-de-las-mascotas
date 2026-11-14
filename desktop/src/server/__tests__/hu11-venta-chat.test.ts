import { describe, expect, it } from 'vitest'
import { nuevaDb, productoCon } from './ayudas'
import { agregarAlias } from '../modules/alias'
import { stockDe } from '../modules/movimientos'
import { listarNoEntendidos } from '../modules/mensajes'
import { parsearVenta, resolverProductos } from '../telegram/ventas'
import { ManejadorChat } from '../telegram/manejador'
import { listarProductos } from '../modules/productos'
import type { BaseDeDatos } from '../db/connection'
import {
  BOTON_CANCELAR,
  BOTON_CONFIRMAR,
  BOTON_EFECTIVO,
  BOTON_VENTA,
  VENTA_CANCELADA,
  VENTA_NO_ENTENDIDA
} from '../telegram/textos'

const CHAT = 111
const AUTORIZADOS = [CHAT]

function tiendaConChow() {
  const db = nuevaDb()
  const chow = productoCon(db, 10, { nombre: 'Concentrado Dog Chow Adulto 8kg', precioVenta: 62000 })
  const collar = productoCon(db, 10, { nombre: 'Collar para perro', categoria: 'Accesorios', precioVenta: 18000 })
  agregarAlias(db, chow, 'dog chow')
  agregarAlias(db, collar, 'collar')
  return { db, chow, collar }
}

const buscar = (db: BaseDeDatos, q: string) =>
  listarProductos(db, { q, activos: true }).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    precioVenta: p.precioVenta,
    activo: p.activo
  }))

describe('HU-11 · Registrar venta por mensaje — parser (Opción A)', () => {
  it('interpreta «<número> <alias>» separado por «y» o comas', () => {
    expect(parsearVenta('2 dog chow y 1 collar')).toEqual({
      ok: true,
      partes: [
        { cantidad: 2, textoProducto: 'dog chow' },
        { cantidad: 1, textoProducto: 'collar' }
      ]
    })
    expect(parsearVenta('3 arena, 1 cuido gato')).toMatchObject({ ok: true })
  })

  it('no especula: lo que no sigue el patrón es "sin_patron" (punto 3 acordado)', () => {
    expect(parsearVenta('dog chow 2 unidades')).toEqual({ ok: false, motivo: 'sin_patron' })
    expect(parsearVenta('3 kg de cuido de gato')).toMatchObject({ ok: true }) // «3» + «kg de cuido de gato»
    expect(parsearVenta('vendí unos collares')).toEqual({ ok: false, motivo: 'sin_patron' })
    expect(parsearVenta('   ')).toEqual({ ok: false, motivo: 'vacio' })
    expect(parsearVenta('0 dog chow')).toEqual({ ok: false, motivo: 'sin_patron' })
  })

  it('resuelve alias a productos y marca no reconocidos/ambiguos', () => {
    const { db } = tiendaConChow()
    const ok = resolverProductos(db, [{ cantidad: 2, textoProducto: 'dog chow' }], buscar)
    expect(ok).toMatchObject({ ok: true })
    const malo = resolverProductos(db, [{ cantidad: 1, textoProducto: 'xyz inexistente' }], buscar)
    expect(malo).toMatchObject({ ok: false, noReconocidos: ['xyz inexistente'] })
  })
})

describe('HU-11 · Flujo de conversación', () => {
  it('C1: un mensaje válido muestra el resumen y pide confirmar (con el método de pago antes)', () => {
    const { db } = tiendaConChow()
    const chat = new ManejadorChat(db, AUTORIZADOS)
    const r = chat.procesar(CHAT, '2 dog chow y 1 collar', 'Alirio')
    const texto = r.map((x) => x.texto).join('\n')
    expect(texto).toContain('Resumen de la venta')
    expect(texto).toContain('2 × Concentrado Dog Chow Adulto 8kg')
    expect(texto).toContain('1 × Collar para perro')
    // 2×62000 + 1×18000 = 142000
    expect(texto).toContain('$142.000')
  })

  it('C2: eligiendo pago y confirmando se descuenta el stock y se registra la venta', () => {
    const { db, chow, collar } = tiendaConChow()
    const chat = new ManejadorChat(db, AUTORIZADOS)
    chat.procesar(CHAT, '2 dog chow y 1 collar', 'Alirio')
    chat.procesar(CHAT, BOTON_EFECTIVO, 'Alirio')
    const r = chat.procesar(CHAT, BOTON_CONFIRMAR, 'Alirio')
    expect(r.map((x) => x.texto).join('\n')).toContain('registrada')
    expect(stockDe(db, chow)).toBe(8)
    expect(stockDe(db, collar)).toBe(9)
  })

  it('C3: cancelar no modifica el stock', () => {
    const { db, chow } = tiendaConChow()
    const chat = new ManejadorChat(db, AUTORIZADOS)
    chat.procesar(CHAT, '2 dog chow', 'Olga')
    chat.procesar(CHAT, BOTON_EFECTIVO, 'Olga')
    const r = chat.procesar(CHAT, BOTON_CANCELAR, 'Olga')
    expect(r.map((x) => x.texto).join('\n')).toContain(VENTA_CANCELADA)
    expect(stockDe(db, chow)).toBe(10)
  })

  it('mensaje no entendido: se guarda como pendiente y no se registra venta (puntos 3 y 4)', () => {
    const { db } = tiendaConChow()
    const chat = new ManejadorChat(db, AUTORIZADOS)
    const r = chat.procesar(CHAT, 'vendi unos collares', 'Olga')
    expect(r.map((x) => x.texto).join('\n')).toContain(VENTA_NO_ENTENDIDA)
    const pendientes = listarNoEntendidos(db, true)
    expect(pendientes).toHaveLength(1)
    expect(pendientes[0]).toMatchObject({ texto: 'vendi unos collares', usuario: 'Olga', estado: 'no_entendido' })
  })

  it('producto no reconocido también va a pendientes', () => {
    const { db } = tiendaConChow()
    const chat = new ManejadorChat(db, AUTORIZADOS)
    chat.procesar(CHAT, '1 producto que no existe', 'Alirio')
    expect(listarNoEntendidos(db, true)).toHaveLength(1)
  })

  it('C/HU-03: venta sobre stock pide una segunda confirmación y, al confirmar, se registra', () => {
    const { db, chow } = tiendaConChow() // stock 10
    const chat = new ManejadorChat(db, AUTORIZADOS)
    chat.procesar(CHAT, '15 dog chow', 'Alirio')
    chat.procesar(CHAT, BOTON_EFECTIVO, 'Alirio')
    const aviso = chat.procesar(CHAT, BOTON_CONFIRMAR, 'Alirio')
    expect(aviso.map((x) => x.texto).join('\n')).toContain('superan el stock')
    expect(stockDe(db, chow)).toBe(10) // todavía no se tocó
    const ok = chat.procesar(CHAT, BOTON_CONFIRMAR, 'Alirio')
    expect(ok.map((x) => x.texto).join('\n')).toContain('registrada')
    expect(stockDe(db, chow)).toBe(-5)
  })

  it('C3 sobre stock: si cancela tras el aviso, el stock no se modifica', () => {
    const { db, chow } = tiendaConChow()
    const chat = new ManejadorChat(db, AUTORIZADOS)
    chat.procesar(CHAT, '15 dog chow', 'Olga')
    chat.procesar(CHAT, BOTON_EFECTIVO, 'Olga')
    chat.procesar(CHAT, BOTON_CONFIRMAR, 'Olga')
    chat.procesar(CHAT, BOTON_CANCELAR, 'Olga')
    expect(stockDe(db, chow)).toBe(10)
  })

  it('HU-10 C3 se mantiene: un chat no autorizado no avanza la conversación', () => {
    const { db } = tiendaConChow()
    const chat = new ManejadorChat(db, AUTORIZADOS)
    const r = chat.procesar(999, BOTON_VENTA, 'Intruso')
    expect(r).toHaveLength(1)
    expect(r[0].teclado).toBeUndefined()
  })
})
