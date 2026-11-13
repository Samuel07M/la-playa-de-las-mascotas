// Valores tomados literalmente del mockup aprobado.
export const USUARIO = 'Isabel'
export const CATEGORIAS = [
  'Alimento perros',
  'Alimento gatos',
  'Higiene',
  'Accesorios',
  'Snacks',
  'Salud',
  'Otros'
] as const
export const METODOS_PAGO = ['efectivo', 'digital'] as const
export const MOTIVOS_BAJA = ['vencido', 'dañado', 'otro'] as const
export const REF_INVENTARIO_INICIAL = 'INV-INICIAL'
export const MOTIVO_ENTRADA = 'Recepción'
export const MOTIVO_INVENTARIO_INICIAL = 'Inventario inicial'

export type Categoria = (typeof CATEGORIAS)[number]
export type MetodoPago = (typeof METODOS_PAGO)[number]
export type MotivoBaja = (typeof MOTIVOS_BAJA)[number]
export type TipoMovimiento = 'venta' | 'entrada' | 'baja'
