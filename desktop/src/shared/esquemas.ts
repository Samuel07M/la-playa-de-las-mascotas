import { z } from 'zod'
import { CATEGORIAS, METODOS_PAGO, MOTIVOS_BAJA } from './constantes'

// Respaldo: cualquier validación de Zod sin mensaje propio responde en español, no en inglés
// («Invalid option: expected one of…»). Los campos de la API llevan además su mensaje sencillo (M).
z.config(z.locales.es())

// Mensajes copiados literalmente del mockup aprobado.
export const M = {
  nombre: 'El nombre es obligatorio.',
  categoria: 'Selecciona una categoría.',
  precio: 'El precio debe ser mayor que 0.',
  stockMinimo: 'Indica un stock mínimo entero (0 o más).',
  alias: 'Escribe un alias.',
  aliasDuplicado: (producto: string) => `Ese alias ya pertenece a «${producto}».`,
  referencia: 'La referencia es obligatoria.',
  productoExistente: 'Selecciona un producto existente.',
  cantidad: 'La cantidad debe ser un entero mayor que 0.',
  productoBaja: 'Selecciona un producto.',
  motivoBaja: 'Debes seleccionar un motivo para guardar.',
  bajaSuperaStock: (stock: number) => `La cantidad supera el stock actual (${stock}).`,
  /** Venta rechazada por falta de stock (cambio pedido por Samuel, docs/PREGUNTAS.md 34). */
  ventaSinStock: (productos: { nombre: string; disponible: number }[]) =>
    'No hay stock suficiente de: ' +
    productos.map((p) => `${p.nombre} (disponible: ${p.disponible})`).join(', ') +
    '. No se registró la venta.',
  // HU-07, HU-08 y HU-09 no tienen mockup: textos propuestos (docs/PREGUNTAS.md, 24).
  correo: 'Escribe un correo válido.',
  proveedorActivo: 'Selecciona un proveedor activo.',
  proveedorNoExiste: 'El proveedor no existe.',
  proveedorSinEliminar: 'Los proveedores no se eliminan: solo se pueden desactivar.',
  fecha: 'Selecciona una fecha.',
  rango: 'La fecha inicial no puede ser posterior a la final.',
  efectivoContado: 'Indica el efectivo contado (entero, 0 o más).',
  digitalContado: 'Indica el monto digital recibido (entero, 0 o más).',
  // Validaciones de la API sin texto en el mockup: mensajes cortos en español (PREGUNTAS 37).
  metodoPago: 'Selecciona un método de pago: efectivo o digital.',
  activo: 'Indica si queda activo o inactivo.',
  texto: 'Escribe un texto válido.',
  filtroActivos: 'El filtro de activos debe ser 0 o 1.',
  cuadreExiste: 'Ya hay un cuadre guardado para este día.'
} as const

const id = (mensaje: string) => z.number({ error: mensaje }).int(mensaje).positive(mensaje)
const cantidad = z.number({ error: M.cantidad }).int(M.cantidad).positive(M.cantidad)

export const productoSchema = z.object({
  nombre: z.string({ error: M.nombre }).trim().min(1, M.nombre),
  categoria: z.enum(CATEGORIAS, { error: M.categoria }),
  precioVenta: z.number({ error: M.precio }).int(M.precio).positive(M.precio),
  stockMinimo: z.number({ error: M.stockMinimo }).int(M.stockMinimo).min(0, M.stockMinimo)
})
export type ProductoEntrada = z.infer<typeof productoSchema>

export const activoSchema = z.object({ activo: z.boolean({ error: M.activo }) })

export const aliasSchema = z.object({
  texto: z.string({ error: M.alias }).trim().min(1, M.alias)
})

export const ventaSchema = z.object({
  metodoPago: z.enum(METODOS_PAGO, { error: M.metodoPago }),
  lineas: z
    .array(z.object({ productoId: id(M.productoExistente), cantidad }, { error: M.productoExistente }), { error: M.productoExistente })
    .min(1, M.productoExistente)
})
export type VentaEntrada = z.infer<typeof ventaSchema>

export const entradaSchema = z.object({
  referencia: z.string({ error: M.referencia }).trim().min(1, M.referencia),
  /** Proveedor opcional de la recepción (compras del reporte de proveedores, HU-09). */
  proveedorId: id(M.proveedorActivo).nullish(),
  lineas: z
    .array(z.object({ productoId: id(M.productoExistente), cantidad }, { error: M.productoExistente }), { error: M.productoExistente })
    .min(1, M.productoExistente)
})
export type EntradaEntrada = z.infer<typeof entradaSchema>

export const bajaSchema = z.object({
  productoId: id(M.productoBaja),
  cantidad,
  motivo: z.enum(MOTIVOS_BAJA, { error: M.motivoBaja }),
  detalle: z.string({ error: M.texto }).trim().optional()
})
export type BajaEntrada = z.infer<typeof bajaSchema>

/** Día "AAAA-MM-DD" que existe en el calendario. */
export const fechaDia = z
  .string({ error: M.fecha })
  .regex(/^\d{4}-\d{2}-\d{2}$/, M.fecha)
  .refine((d) => {
    const t = Date.parse(d + 'T00:00:00Z')
    return !Number.isNaN(t) && new Date(t).toISOString().startsWith(d)
  }, M.fecha)

const opcional = z
  .string({ error: M.texto })
  .trim()
  .nullish()
  .transform((v) => v || null)

// HU-07
export const proveedorSchema = z.object({
  nombre: z.string({ error: M.nombre }).trim().min(1, M.nombre),
  telefono: opcional,
  correo: opcional.refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), M.correo)
})
export type ProveedorEntrada = z.infer<typeof proveedorSchema>

export const precioProveedorSchema = z.object({
  productoId: id(M.productoExistente),
  precio: z.number({ error: M.precio }).int(M.precio).positive(M.precio),
  fecha: fechaDia
})
export type PrecioProveedorEntrada = z.infer<typeof precioProveedorSchema>

// HU-08
export const cuadreSchema = z.object({
  dia: fechaDia,
  efectivoContado: z.number({ error: M.efectivoContado }).int(M.efectivoContado).min(0, M.efectivoContado),
  digitalContado: z.number({ error: M.digitalContado }).int(M.digitalContado).min(0, M.digitalContado)
})
export type CuadreEntrada = z.infer<typeof cuadreSchema>

// HU-09
export const rangoSchema = z
  .object({ desde: fechaDia, hasta: fechaDia })
  .refine((r) => r.desde <= r.hasta, { message: M.rango, path: ['desde'] })
export type Rango = z.infer<typeof rangoSchema>

/**
 * Convierte los errores de Zod en { campo: mensaje } (primer mensaje por campo),
 * con el campo como ruta unida por puntos: "precioVenta", "lineas.0.cantidad".
 */
export function erroresPorCampo(error: z.ZodError): Record<string, string> {
  const r: Record<string, string> = {}
  for (const i of error.issues) {
    const campo = i.path.join('.')
    if (!(campo in r)) r[campo] = i.message
  }
  return r
}

/** Texto de un input numérico → número (o undefined si está vacío), como lo lee el mockup. */
export const numeroDe = (v: string): number | undefined => (v.trim() === '' ? undefined : Number(v))
