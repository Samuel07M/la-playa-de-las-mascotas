// Interpretación del mensaje de venta del chat (HU-11), lógica pura y testeable.
// Opción A acordada: formato mínimo «<número> <alias>», partes separadas por "y", comas o
// saltos de línea. Todo lo que no calce es un mensaje "no entendido" (lo revisa Isabel, HU-15).
// No se especula: si falta el número o el alias no se reconoce sin ambigüedad, no se interpreta.

import type { BaseDeDatos } from '../db/connection'

/** Una parte reconocida del mensaje: cantidad entera > 0 y el texto del producto escrito. */
export interface ParteVenta {
  cantidad: number
  textoProducto: string
}

export type ResultadoParseo =
  | { ok: true; partes: ParteVenta[] }
  | { ok: false; motivo: 'vacio' | 'sin_patron' }

/** Separa el mensaje en partes por "y", comas o saltos de línea. */
function separar(texto: string): string[] {
  return texto
    .split(/\s+y\s+|,|\n/gi)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

// Cada parte debe ser «<número> <resto>»: el número primero, luego el nombre/alias del producto.
const PARTE = /^(\d+)\s+(.+)$/

/**
 * Interpreta el texto libre a partes <cantidad, textoProducto>. No toca la base de datos:
 * solo valida la forma. Si alguna parte no calza con el patrón, todo el mensaje es "sin_patron".
 */
export function parsearVenta(texto: string): ResultadoParseo {
  const partes = separar(texto)
  if (partes.length === 0) return { ok: false, motivo: 'vacio' }
  const resultado: ParteVenta[] = []
  for (const p of partes) {
    const m = PARTE.exec(p)
    if (!m) return { ok: false, motivo: 'sin_patron' }
    const cantidad = Number(m[1])
    if (!Number.isInteger(cantidad) || cantidad <= 0) return { ok: false, motivo: 'sin_patron' }
    resultado.push({ cantidad, textoProducto: m[2].trim() })
  }
  return { ok: true, partes: resultado }
}

/** Línea resuelta a un producto concreto del catálogo. */
export interface LineaResuelta {
  productoId: number
  nombre: string
  cantidad: number
  precioVenta: number
}

export type ResultadoResolucion =
  | { ok: true; lineas: LineaResuelta[] }
  | { ok: false; noReconocidos: string[]; ambiguos: string[] }

/**
 * Resuelve cada texto de producto a un producto activo del catálogo, usando las mismas reglas
 * de búsqueda del mockup (nombre, categoría o alias). Debe haber exactamente una coincidencia:
 * - 0 coincidencias → no reconocido.
 * - 2 o más → ambiguo (se trata como no entendido; punto 4 acordado).
 * Las partes del mismo producto se suman en una sola línea.
 */
export function resolverProductos(
  db: BaseDeDatos,
  partes: ParteVenta[],
  buscar: (db: BaseDeDatos, q: string) => { id: number; nombre: string; precioVenta: number; activo: boolean }[]
): ResultadoResolucion {
  const noReconocidos: string[] = []
  const ambiguos: string[] = []
  const porProducto = new Map<number, LineaResuelta>()

  for (const parte of partes) {
    const activos = buscar(db, parte.textoProducto).filter((p) => p.activo)
    if (activos.length === 0) {
      noReconocidos.push(parte.textoProducto)
      continue
    }
    if (activos.length > 1) {
      ambiguos.push(parte.textoProducto)
      continue
    }
    const p = activos[0]
    const previa = porProducto.get(p.id)
    if (previa) previa.cantidad += parte.cantidad
    else porProducto.set(p.id, { productoId: p.id, nombre: p.nombre, cantidad: parte.cantidad, precioVenta: p.precioVenta })
  }

  if (noReconocidos.length > 0 || ambiguos.length > 0) return { ok: false, noReconocidos, ambiguos }
  return { ok: true, lineas: [...porProducto.values()] }
}

/** Resumen de la venta en texto (HU-11, criterio 1): líneas con cantidad, producto, subtotal y total. */
export function resumenVenta(lineas: LineaResuelta[], money: (n: number) => string): string {
  const filas = lineas.map((l) => `• ${l.cantidad} × ${l.nombre} — ${money(l.cantidad * l.precioVenta)}`)
  const total = lineas.reduce((a, l) => a + l.cantidad * l.precioVenta, 0)
  return ['Resumen de la venta:', ...filas, '', `Total: ${money(total)}`].join('\n')
}

/** Resumen de productos sin precio, para entrada y baja (HU-12). */
export function resumenCantidades(titulo: string, lineas: LineaResuelta[]): string {
  const filas = lineas.map((l) => `• ${l.cantidad} × ${l.nombre}`)
  return [titulo, ...filas].join('\n')
}
