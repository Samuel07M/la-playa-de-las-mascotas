// Registro (log) de avisos del chat de Telegram. En la app instalada no hay consola, así que los
// avisos (arrancó, no hay token, error de red) se escriben también en un archivo de la carpeta de
// datos de la app (telegram.log), junto a playa.db.

import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { dirname } from 'node:path'

export type NivelRegistro = 'INFO' | 'AVISO' | 'ERROR'

export interface Registro {
  info(mensaje: string): void
  aviso(mensaje: string, detalle?: unknown): void
  error(mensaje: string, detalle?: unknown): void
}

/** Tamaño a partir del cual, al arrancar, el log se renombra a «.1» para que no crezca sin límite. */
const TAMANO_MAXIMO = 1024 * 1024

/** Texto legible del detalle de un error (sin la pila completa, para que el log se lea fácil). */
function textoDetalle(detalle: unknown): string {
  if (detalle === undefined) return ''
  if (detalle instanceof Error) {
    const causa = (detalle as Error & { cause?: unknown }).cause
    return ` — ${detalle.message}${causa instanceof Error ? ` (${causa.message})` : ''}`
  }
  return ` — ${String(detalle)}`
}

/** Una línea del log: «2026-11-14T18:30:00.000Z [AVISO] mensaje — detalle». */
export function lineaDeRegistro(nivel: NivelRegistro, mensaje: string, detalle?: unknown, fecha = new Date()): string {
  return `${fecha.toISOString()} [${nivel}] ${mensaje}${textoDetalle(detalle)}`
}

/** Registro solo en consola (desarrollo y pruebas). */
export const registroConsola: Registro = {
  info: (m) => console.log(`[telegram] ${m}`),
  aviso: (m, d) => console.warn(`[telegram] ${m}`, d ?? ''),
  error: (m, d) => console.error(`[telegram] ${m}`, d ?? '')
}

/**
 * Registro que escribe en consola y en el archivo `ruta`. Si no se puede escribir el archivo,
 * se sigue solo con la consola: el log nunca debe impedir que la app funcione.
 */
export function registroEnArchivo(ruta: string): Registro {
  try {
    mkdirSync(dirname(ruta), { recursive: true })
    if (existsSync(ruta) && statSync(ruta).size > TAMANO_MAXIMO) renameSync(ruta, ruta + '.1')
  } catch {
    // Sin permisos o disco lleno: se ignora.
  }
  const escribir = (nivel: NivelRegistro, m: string, d?: unknown) => {
    try {
      appendFileSync(ruta, lineaDeRegistro(nivel, m, d) + '\n', 'utf8')
    } catch {
      // Se ignora: el registro en consola sigue funcionando.
    }
  }
  return {
    info: (m) => {
      registroConsola.info(m)
      escribir('INFO', m)
    },
    aviso: (m, d) => {
      registroConsola.aviso(m, d)
      escribir('AVISO', m, d)
    },
    error: (m, d) => {
      registroConsola.error(m, d)
      escribir('ERROR', m, d)
    }
  }
}
