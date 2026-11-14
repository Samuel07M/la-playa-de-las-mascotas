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
  VENTA_NO_ENTENDIDA,
  VENTA_PEDIR_PAGO
} from '../telegram/textos'
import { tecladoPrincipal } from '../telegram/logica'
import { registrarVenta } from '../modules/ventas'

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

  it('C/HU-03: venta que supera el stock se RECHAZA antes del resumen y de pedir el método de pago', () => {
    const { db, chow } = tiendaConChow() // stock 10
    const chat = new ManejadorChat(db, AUTORIZADOS)
    const r = chat.procesar(CHAT, '15 dog chow', 'Alirio')
    const texto = r.map((x) => x.texto).join('\n')
    expect(texto).toBe('No hay stock suficiente de: Concentrado Dog Chow Adulto 8kg (disponible: 10). No se registró la venta.')
    expect(texto).not.toContain('Resumen de la venta')
    expect(texto).not.toContain(VENTA_PEDIR_PAGO)
    // Vuelve al teclado principal (sin botones Efectivo/Digital) y a inactivo.
    expect(r.at(-1)!.teclado).toEqual(tecladoPrincipal())
    expect(stockDe(db, chow)).toBe(10)
    // No es un mensaje "no entendido": no se guarda como pendiente.
    expect(listarNoEntendidos(db, true)).toHaveLength(0)
    // Pulsar Efectivo después no continúa ninguna venta.
    chat.procesar(CHAT, BOTON_EFECTIVO, 'Alirio')
    chat.procesar(CHAT, BOTON_CONFIRMAR, 'Alirio')
    expect(stockDe(db, chow)).toBe(10)
    expect(db.prepare(`SELECT COUNT(*) AS n FROM ventas`).get()).toEqual({ n: 0 })
  })

  it('C/HU-03: el rechazo indica el disponible de cada producto que no alcanza', () => {
    const { db } = tiendaConChow()
    const chat = new ManejadorChat(db, AUTORIZADOS)
    const r = chat.procesar(CHAT, '11 dog chow y 12 collar', 'Olga')
    expect(r.map((x) => x.texto).join('\n')).toBe(
      'No hay stock suficiente de: Concentrado Dog Chow Adulto 8kg (disponible: 10), Collar para perro (disponible: 10). No se registró la venta.'
    )
  })

  it('C/HU-03: el mismo producto en dos partes que juntas superan el stock se rechaza', () => {
    const { db, chow } = tiendaConChow()
    const chat = new ManejadorChat(db, AUTORIZADOS)
    const r = chat.procesar(CHAT, '6 dog chow y 5 dog chow', 'Olga')
    expect(r.map((x) => x.texto).join('\n')).toContain('No hay stock suficiente de: Concentrado Dog Chow Adulto 8kg (disponible: 10)')
    expect(stockDe(db, chow)).toBe(10)
  })

  it('respaldo del backend: si el stock cambió antes de confirmar, la venta se rechaza al confirmar', () => {
    const { db, chow } = tiendaConChow()
    const chat = new ManejadorChat(db, AUTORIZADOS)
    chat.procesar(CHAT, '8 dog chow', 'Alirio')
    chat.procesar(CHAT, BOTON_EFECTIVO, 'Alirio')
    // Mientras tanto, Isabel vende 5 en la app: quedan 5.
    registrarVenta(db, { metodoPago: 'digital', lineas: [{ productoId: chow, cantidad: 5 }] })
    const r = chat.procesar(CHAT, BOTON_CONFIRMAR, 'Alirio')
    expect(r.map((x) => x.texto).join('\n')).toBe(
      'No hay stock suficiente de: Concentrado Dog Chow Adulto 8kg (disponible: 5). No se registró la venta.'
    )
    expect(r.at(-1)!.teclado).toEqual(tecladoPrincipal())
    expect(stockDe(db, chow)).toBe(5)
    // La conversación quedó inactiva: otro Confirmar no registra nada.
    chat.procesar(CHAT, BOTON_CONFIRMAR, 'Alirio')
    expect(stockDe(db, chow)).toBe(5)
  })

  it('HU-10 C3 se mantiene: un chat no autorizado no avanza la conversación', () => {
    const { db } = tiendaConChow()
    const chat = new ManejadorChat(db, AUTORIZADOS)
    const r = chat.procesar(999, BOTON_VENTA, 'Intruso')
    expect(r).toHaveLength(1)
    expect(r[0].teclado).toBeUndefined()
  })
})
