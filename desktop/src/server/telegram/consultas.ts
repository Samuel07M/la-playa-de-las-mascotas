// HU-13: consultar precio y stock por mensaje. Lógica pura (sin BD ni red): recibe el texto del
// operario y la lista de productos activos, y decide si hay un producto, varios o solo parecidos.
// La consulta es de solo lectura: aquí no se escribe nada.

/** Producto activo con lo que necesita la consulta. */
export interface ProductoConsultable {
  id: number
  nombre: string
  categoria: string
  precioVenta: number
  stock: number
  alias: string[]
}

export type ResultadoConsulta =
  /** Un solo producto coincide: se responde precio y stock. */
  | { tipo: 'encontrado'; producto: ProductoConsultable }
  /** Varios productos contienen el texto: se ofrecen como botones. */
  | { tipo: 'varios'; opciones: ProductoConsultable[] }
  /** Ninguno lo contiene: se sugieren los más parecidos (puede venir vacío). */
  | { tipo: 'parecidos'; opciones: ProductoConsultable[] }

/** Máximo de botones de sugerencia (uno por fila, para que se lean bien). */
export const MAX_SUGERENCIAS = 4
/** Parecido mínimo (0 a 1) para sugerir un producto. */
const UMBRAL_PARECIDO = 0.6

/** Minúsculas, sin tildes y con espacios simples: «Arena  Sanitaria» → «arena sanitaria». */
export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Distancia de edición (Levenshtein) entre dos palabras. */
function distancia(a: string, b: string): number {
  let previa = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const actual = [i]
    for (let j = 1; j <= b.length; j++) {
      actual[j] = Math.min(previa[j] + 1, actual[j - 1] + 1, previa[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    previa = actual
  }
  return previa[b.length]
}

/** Parecido entre dos palabras (0 a 1). Un prefijo de 3+ letras cuenta casi como igual («aren» ~ «arena»). */
function parecidoPalabra(q: string, c: string): number {
  if (q === c) return 1
  if (Math.min(q.length, c.length) >= 3 && (c.startsWith(q) || q.startsWith(c))) return 0.9
  return 1 - distancia(q, c) / Math.max(q.length, c.length)
}

/** Parecido del texto con un producto: promedio, por palabra buscada, de su mejor palabra del nombre o alias. */
export function parecido(texto: string, p: ProductoConsultable): number {
  const qs = normalizar(texto).split(' ').filter(Boolean)
  const cs = [p.nombre, ...p.alias].flatMap((x) => normalizar(x).split(' ')).filter(Boolean)
  if (!qs.length || !cs.length) return 0
  const suma = qs.reduce((acc, q) => acc + Math.max(...cs.map((c) => parecidoPalabra(q, c))), 0)
  return suma / qs.length
}

/**
 * Busca el producto de la consulta:
 * 1. Nombre o alias exactamente igual (sin distinguir mayúsculas ni tildes) → encontrado.
 *    Así, tocar un botón de sugerencia (que envía el nombre) siempre encuentra el producto.
 * 2. Nombre, categoría o alias que contienen el texto (como la búsqueda del catálogo):
 *    uno → encontrado; varios → se ofrecen como botones.
 * 3. Si nada lo contiene → los más parecidos (criterio 3).
 */
export function buscarParaConsulta(texto: string, productos: ProductoConsultable[]): ResultadoConsulta {
  const q = normalizar(texto)
  const exacto = productos.find((p) => normalizar(p.nombre) === q || p.alias.some((a) => normalizar(a) === q))
  if (exacto) return { tipo: 'encontrado', producto: exacto }

  const contienen = productos.filter(
    (p) => normalizar(p.nombre + ' ' + p.categoria).includes(q) || p.alias.some((a) => normalizar(a).includes(q))
  )
  if (contienen.length === 1) return { tipo: 'encontrado', producto: contienen[0] }
  if (contienen.length > 1) {
    const orden = [...contienen].sort((a, b) => parecido(texto, b) - parecido(texto, a) || a.nombre.localeCompare(b.nombre, 'es'))
    return { tipo: 'varios', opciones: orden.slice(0, MAX_SUGERENCIAS) }
  }

  const parecidos = productos
    .map((p) => ({ p, s: parecido(texto, p) }))
    .filter((x) => x.s >= UMBRAL_PARECIDO)
    .sort((a, b) => b.s - a.s || a.p.nombre.localeCompare(b.p.nombre, 'es'))
    .slice(0, MAX_SUGERENCIAS)
    .map((x) => x.p)
  return { tipo: 'parecidos', opciones: parecidos }
}
