// Carga de variables desde un archivo .env, sin dependencias.
// - Desarrollo: el .env está en la raíz del repositorio (no se empaqueta ni se sube a git).
// - App instalada: el .env va en la carpeta de datos de la app (userData), la misma de playa.db:
//   %APPDATA%\La Playa de las Mascotas\.env
// Si el archivo no existe o no trae token, la app funciona igual, sin chat de Telegram.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Parsea el contenido de un .env a pares clave/valor. Ignora comentarios y líneas vacías. */
export function parsearEnv(contenido: string): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const linea of contenido.replace(/^﻿/, '').split(/\r?\n/)) {
    const t = linea.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    const clave = t.slice(0, i).trim()
    let valor = t.slice(i + 1).trim()
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1)
    }
    if (clave) vars[clave] = valor
  }
  return vars
}

/**
 * Carpeta de datos de la app y ruta del .env según cómo se ejecuta.
 * Es una función pura (recibe las rutas de Electron) para poder probarla sin Electron.
 * - Instalada (empaquetada): datos y .env en userData.
 * - Desarrollo: datos en desktop/dev-data y .env en la raíz del repositorio.
 */
export function rutasDeLaApp(o: { empaquetada: boolean; userData: string; appPath: string }): {
  carpetaDatos: string
  env: string
} {
  if (o.empaquetada) return { carpetaDatos: o.userData, env: join(o.userData, '.env') }
  return { carpetaDatos: join(o.appPath, 'dev-data'), env: join(o.appPath, '..', '.env') }
}

/**
 * Si existe `ruta`, carga sus variables en process.env sin sobrescribir las ya definidas.
 * Devuelve si el archivo existía (para dejarlo en el registro).
 */
export function cargarEnv(ruta: string): boolean {
  if (!existsSync(ruta)) return false
  const vars = parsearEnv(readFileSync(ruta, 'utf8'))
  for (const [clave, valor] of Object.entries(vars)) {
    if (process.env[clave] === undefined) process.env[clave] = valor
  }
  return true
}
