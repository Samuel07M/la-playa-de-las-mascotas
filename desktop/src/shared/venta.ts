/** Total de la venta: suma de cantidad × precio vigente de cada línea (HU-03, criterio 3). */
export function totalVenta(lineas: { cantidad: number; precio: number }[]): number {
  return lineas.reduce((a, l) => a + l.cantidad * l.precio, 0)
}

/** Cantidad de una línea a partir de lo escrito: entero ≥ 1 (setQ del mockup). */
export function cantidadDe(v: string | number): number {
  return Math.max(1, parseInt(String(v)) || 1)
}

/** Tiempo transcurrido "m:ss" desde t0 (tm del mockup). */
export function cronometro(t0: number | null, ahora = Date.now()): string {
  const s = t0 ? Math.floor((ahora - t0) / 1e3) : 0
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}
