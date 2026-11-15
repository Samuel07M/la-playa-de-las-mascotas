import { describe, expect, it } from 'vitest'
import { nuevaDb, productoCon } from './ayudas'
import { agregarAlias } from '../modules/alias'
import { registrarVenta } from '../modules/ventas'
import { ManejadorChat } from '../telegram/manejador'
import { tecladoPrincipal } from '../telegram/logica'
import { buscarParaConsulta, normalizar, parecido, type ProductoConsultable } from '../telegram/consultas'
import {
  BOTON_CANCELAR,
  BOTON_CONSULTA,
  BOTON_VENTA,
  CONSULTA_CANCELADA,
  CONSULTA_PEDIR,
  VENTA_PEDIR
} from '../telegram/textos'
import type { BaseDeDatos } from '../db/connection'

const CHAT = 111
const AUTORIZADOS = [CHAT]

function tienda() {
  const db = nuevaDb()
  const chow = productoCon(db, 11, { nombre: 'Concentrado Dog Chow Adulto 8kg', precioVenta: 62000 })
  const gatsy = productoCon(db, 3, { nombre: 'Concentrado Gatsy Gatos 3kg', categoria: 'Alimento gatos', precioVenta: 38000 })
  const arena = productoCon(db, 1, { nombre: 'Arena sanitaria 10kg', categoria: 'Higiene', precioVenta: 24000 })
  const collar = productoCon(db, 0, { nombre: 'Collar para perro', categoria: 'Accesorios', precioVenta: 18000 })
  agregarAlias(db, chow, 'dog chow')
  agregarAlias(db, arena, 'arena')
  return { db, chow, gatsy, arena, collar }
}

const texto = (r: { texto: string }[]) => r.map((x) => x.texto).join('\n')
const botones = (r: { teclado?: { keyboard: { text: string }[][] } }[]) =>
  r.at(-1)!.teclado!.keyboard.map((fila) => fila.map((b) => b.text))

/** Huella de todos los datos: si una consulta escribiera algo, cambiaría. */
function huella(db: BaseDeDatos): string {
  const tablas = ['productos', 'alias', 'movimientos', 'ventas', 'mensajes']
  const filas = tablas.map((t) => db.prepare(`SELECT * FROM ${t} ORDER BY 1`).all())
  const cambios = db.prepare('SELECT total_changes() AS n').get()
  return JSON.stringify({ filas, cambios })
}

function consultar(chat: ManejadorChat, q: string) {
  chat.procesar(CHAT, BOTON_CONSULTA, 'Alirio')
  return chat.procesar(CHAT, q, 'Alirio')
}

describe('HU-13 · Consultar precio y stock por mensaje', () => {
  it('el botón «Consultar precio y stock» pide el producto y deja cancelar', () => {
    const { db } = tienda()
    const r = new ManejadorChat(db, AUTORIZADOS).procesar(CHAT, BOTON_CONSULTA, 'Olga')
    expect(texto(r)).toBe(CONSULTA_PEDIR)
    expect(botones(r)).toEqual([[BOTON_CANCELAR]])
  })

  it('C1 y C2: responde el precio vigente y el stock actual, y vuelve al menú principal', () => {
    const { db } = tienda()
    const r = consultar(new ManejadorChat(db, AUTORIZADOS), 'dog chow')
    expect(texto(r)).toBe('Concentrado Dog Chow Adulto 8kg\n\nPrecio: $62.000\nQuedan: 11 unidades.')
    expect(r.at(-1)!.teclado).toEqual(tecladoPrincipal())
  })

  it('C1: el precio es el vigente (si cambia, la consulta muestra el nuevo)', () => {
    const { db, chow } = tienda()
    db.prepare('UPDATE productos SET precio_venta = 65000 WHERE id = ?').run(chow)
    expect(texto(consultar(new ManejadorChat(db, AUTORIZADOS), 'dog chow'))).toContain('Precio: $65.000')
  })

  it('C2: el stock es el actual, calculado desde los movimientos (singular y cero incluidos)', () => {
    const { db, chow } = tienda()
    registrarVenta(db, { metodoPago: 'efectivo', lineas: [{ productoId: chow, cantidad: 4 }] })
    const chat = new ManejadorChat(db, AUTORIZADOS)
    expect(texto(consultar(chat, 'dog chow'))).toContain('Quedan: 7 unidades.')
    expect(texto(consultar(chat, 'arena'))).toContain('Quedan: 1 unidad.')
    expect(texto(consultar(chat, 'collar para perro'))).toContain('Quedan: 0 unidades.')
  })

  it('encuentra por nombre, alias o parte del nombre, sin distinguir mayúsculas ni tildes', () => {
    const { db } = tienda()
    const chat = new ManejadorChat(db, AUTORIZADOS)
    expect(texto(consultar(chat, 'DOG CHOW'))).toContain('Concentrado Dog Chow Adulto 8kg')
    expect(texto(consultar(chat, 'gatsy'))).toContain('Concentrado Gatsy Gatos 3kg')
    expect(texto(consultar(chat, 'sanitária'))).toContain('Arena sanitaria 10kg')
  })

  it('C3: si no lo encuentra, sugiere opciones parecidas con botones (más Cancelar)', () => {
    const { db } = tienda()
    const r = consultar(new ManejadorChat(db, AUTORIZADOS), 'dog chou')
    expect(texto(r)).toBe('No encontré «dog chou». ¿Buscabas alguno de estos? Toca uno o escribe el nombre de nuevo.')
    const b = botones(r)
    expect(b[0]).toEqual(['Concentrado Dog Chow Adulto 8kg'])
    expect(b.at(-1)).toEqual([BOTON_CANCELAR])
  })

  it('C3: tocar una sugerencia responde el precio y stock de ese producto', () => {
    const { db } = tienda()
    const chat = new ManejadorChat(db, AUTORIZADOS)
    const r = consultar(chat, 'colar')
    expect(botones(r)[0]).toEqual(['Collar para perro'])
    const ok = chat.procesar(CHAT, 'Collar para perro', 'Alirio')
    expect(texto(ok)).toBe('Collar para perro\n\nPrecio: $18.000\nQuedan: 0 unidades.')
  })

  it('si varios productos coinciden, los ofrece como botones para elegir', () => {
    const { db } = tienda()
    const chat = new ManejadorChat(db, AUTORIZADOS)
    const r = consultar(chat, 'concentrado')
    expect(texto(r)).toBe('Hay varios productos que coinciden con «concentrado». Toca el que buscas o escribe el nombre más completo.')
    expect(botones(r).flat()).toEqual(['Concentrado Dog Chow Adulto 8kg', 'Concentrado Gatsy Gatos 3kg', BOTON_CANCELAR])
    expect(texto(chat.procesar(CHAT, 'Concentrado Gatsy Gatos 3kg', 'Alirio'))).toContain('Precio: $38.000')
  })

  it('si no hay nada parecido, lo dice y sigue esperando el nombre (solo Cancelar)', () => {
    const { db } = tienda()
    const chat = new ManejadorChat(db, AUTORIZADOS)
    const r = consultar(chat, 'xyzw')
    expect(texto(r)).toBe('No encontré «xyzw» ni productos parecidos. Escribe el nombre de nuevo o toca «Cancelar».')
    expect(botones(r)).toEqual([[BOTON_CANCELAR]])
    // Sigue en la consulta: el siguiente mensaje se busca.
    expect(texto(chat.procesar(CHAT, 'arena', 'Alirio'))).toContain('Arena sanitaria 10kg')
  })

  it('no muestra productos desactivados', () => {
    const { db, gatsy } = tienda()
    db.prepare('UPDATE productos SET activo = 0 WHERE id = ?').run(gatsy)
    expect(texto(consultar(new ManejadorChat(db, AUTORIZADOS), 'concentrado'))).toContain('Concentrado Dog Chow Adulto 8kg')
    expect(texto(consultar(new ManejadorChat(db, AUTORIZADOS), 'gatsy'))).not.toContain('Precio')
  })

  it('Cancelar o un botón del menú durante la consulta salen de ella', () => {
    const { db } = tienda()
    const chat = new ManejadorChat(db, AUTORIZADOS)
    chat.procesar(CHAT, BOTON_CONSULTA, 'Olga')
    const c = chat.procesar(CHAT, BOTON_CANCELAR, 'Olga')
    expect(texto(c)).toBe(CONSULTA_CANCELADA)
    expect(c.at(-1)!.teclado).toEqual(tecladoPrincipal())
    chat.procesar(CHAT, BOTON_CONSULTA, 'Olga')
    expect(texto(chat.procesar(CHAT, BOTON_VENTA, 'Olga'))).toBe(VENTA_PEDIR)
  })

  it('C4: ninguna consulta modifica datos (encontrado, varios, parecidos, sin resultados, cancelar)', () => {
    const { db } = tienda()
    const chat = new ManejadorChat(db, AUTORIZADOS)
    const antes = huella(db)
    for (const q of ['dog chow', 'concentrado', 'colar', 'xyzw']) consultar(chat, q)
    chat.procesar(CHAT, 'Collar para perro', 'Alirio')
    chat.procesar(CHAT, BOTON_CONSULTA, 'Alirio')
    chat.procesar(CHAT, BOTON_CANCELAR, 'Alirio')
    expect(huella(db)).toBe(antes)
  })
})

describe('HU-13 · Búsqueda y parecido (lógica pura)', () => {
  const productos: ProductoConsultable[] = [
    { id: 1, nombre: 'Concentrado Dog Chow Adulto 8kg', categoria: 'Alimento perros', precioVenta: 62000, stock: 11, alias: ['dog chow'] },
    { id: 2, nombre: 'Arena sanitaria 10kg', categoria: 'Higiene', precioVenta: 24000, stock: 1, alias: ['arena'] },
    { id: 3, nombre: 'Collar para perro', categoria: 'Accesorios', precioVenta: 18000, stock: 0, alias: [] }
  ]

  it('normaliza mayúsculas, tildes y espacios', () => {
    expect(normalizar('  Arena   SANITÁRIA ')).toBe('arena sanitaria')
  })

  it('el nombre o alias exacto gana aunque otro producto también lo contenga', () => {
    expect(buscarParaConsulta('arena', productos)).toMatchObject({ tipo: 'encontrado', producto: { id: 2 } })
  })

  it('las palabras mal escritas o incompletas se parecen; las ajenas no', () => {
    expect(parecido('colar', productos[2])).toBeGreaterThanOrEqual(0.6)
    expect(parecido('aren sanitari', productos[1])).toBeGreaterThanOrEqual(0.6)
    expect(parecido('xyzw', productos[0])).toBeLessThan(0.6)
    expect(buscarParaConsulta('pedigree', productos)).toEqual({ tipo: 'parecidos', opciones: [] })
  })

  it('sugiere como máximo 4 opciones', () => {
    const muchos = Array.from({ length: 6 }, (_, i) => ({ ...productos[0], id: 10 + i, nombre: `Concentrado ${i}`, alias: [] }))
    const r = buscarParaConsulta('concentrado', muchos)
    expect(r.tipo).toBe('varios')
    expect(r.tipo !== 'encontrado' && r.opciones).toHaveLength(4)
  })
})
