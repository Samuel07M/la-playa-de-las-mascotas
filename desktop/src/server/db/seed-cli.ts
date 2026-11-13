// `npm run seed`: carga los datos de demostración en desktop/dev-data/playa.db.
// Nunca se ejecuta en la instalación de la tienda.
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { abrirBaseDeDatos } from './connection'
import { seed } from './seed'

const carpeta = join(process.cwd(), 'dev-data')
mkdirSync(carpeta, { recursive: true })
const ruta = join(carpeta, 'playa.db')
const db = abrirBaseDeDatos(ruta)
const { n } = db.prepare('SELECT COUNT(*) AS n FROM productos').get() as { n: number }
if (n > 0) {
  console.error(
    `La base de desarrollo ya tiene datos (${ruta}).\n` +
      'Cierra la app, borra la carpeta dev-data y vuelve a ejecutar `npm run seed`.'
  )
  process.exit(1)
}
seed(db)
db.close()
console.log(`Datos de demostración cargados en ${ruta}`)
