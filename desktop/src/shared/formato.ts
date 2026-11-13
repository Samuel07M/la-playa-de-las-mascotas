// Formatos del mockup: money() y fd().
const ZONA = 'America/Bogota'

/** $62.000 — COP sin decimales. */
export const money = (n: number): string => '$' + Math.round(n).toLocaleString('es-CO')

/** "12 nov, 2:30 p. m." — mismo formato del mockup, en hora de Colombia. */
export const fd = (iso: string): string =>
  new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: ZONA
  })

/** "efectivo" → "Efectivo", "dañado" → "Dañado" (así se muestran en el mockup). */
export const capitalizar = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s)

/** Inicio y fin (instantes ISO UTC) de un día "AAAA-MM-DD" en hora de Colombia (UTC−5, sin horario de verano). */
export function limitesDia(dia: string): { desde: string; hasta: string } {
  const desde = new Date(`${dia}T00:00:00.000-05:00`)
  const hasta = new Date(`${dia}T23:59:59.999-05:00`)
  return { desde: desde.toISOString(), hasta: hasta.toISOString() }
}
