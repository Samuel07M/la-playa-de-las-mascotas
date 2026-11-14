// Carga de variables desde un archivo .env, sin dependencias.
// Solo se usa en desarrollo: el .env está en la raíz del repositorio y no se empaqueta.
// En la app instalada las variables se toman del entorno del sistema.

import { existsSync, readFileSync } from 'node:fs'

/** Parsea el contenido de un .env a pares clave/valor. Ignora comentarios y líneas vacías. */
export function parsearEnv(contenido: string): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const linea of contenido.split(/\r?\n/)) {
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

/** Si existe `ruta`, carga sus variables en process.env sin sobrescribir las ya definidas. */
export function cargarEnv(ruta: string): void {
  if (!existsSync(ruta)) return
  const vars = parsearEnv(readFileSync(ruta, 'utf8'))
  for (const [clave, valor] of Object.entries(vars)) {
    if (process.env[clave] === undefined) process.env[clave] = valor
  }
}
