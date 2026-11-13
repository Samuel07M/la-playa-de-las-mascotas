import Database from 'better-sqlite3'
import esquemaV1 from './schema.sql?raw'
import esquemaV2 from './schema-v2.sql?raw'

export type BaseDeDatos = Database.Database

// Cada posición es una versión del esquema (PRAGMA user_version).
// Nunca se edita una migración ya publicada: se agrega una nueva al final.
const MIGRACIONES: string[] = [esquemaV1, esquemaV2]

export function abrirBaseDeDatos(ruta: string): BaseDeDatos {
  const db = new Database(ruta)
  db.pragma('foreign_keys = ON')
  if (ruta !== ':memory:') db.pragma('journal_mode = WAL')
  aplicarEsquema(db)
  return db
}

export function aplicarEsquema(db: BaseDeDatos): void {
  const actual = db.pragma('user_version', { simple: true }) as number
  for (let v = actual; v < MIGRACIONES.length; v++) {
    db.transaction(() => {
      db.exec(MIGRACIONES[v])
      db.pragma(`user_version = ${v + 1}`)
    })()
  }
}
