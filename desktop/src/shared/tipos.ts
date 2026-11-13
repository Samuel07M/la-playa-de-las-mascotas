import type { Categoria, MetodoPago, TipoMovimiento } from './constantes'

export interface Alias {
  id: number
  texto: string
}

export interface Producto {
  id: number
  nombre: string
  categoria: Categoria
  precioVenta: number
  stockMinimo: number
  activo: boolean
  stock: number
  alias: Alias[]
  /** Solo en búsquedas: alias que coincidió cuando el nombre/categoría no coinciden. */
  aliasCoincidente?: string | null
}

export interface Movimiento {
  id: number
  productoId: number
  producto: string
  tipo: TipoMovimiento
  cantidad: number
  motivo: string
  referencia: string | null
  detalle: string | null
  usuario: string
  fecha: string
}

export interface EntradaReciente {
  referencia: string
  fecha: string
  productos: { nombre: string; cantidad: number }[]
}

export interface ResumenBaja {
  motivo: string
  cantidad: number
  valor: number
}

export interface FilaInventario {
  id: number
  nombre: string
  categoria: string
  stock: number
  stockMinimo: number
  bajoMinimo: boolean
}

export interface Verificacion {
  productoId: number
  sumaMovimientos: number
  stockMostrado: number
  coinciden: boolean
}

export interface VentaRegistrada {
  id: number
  consecutivo: string
  metodoPago: MetodoPago
  total: number
}

export interface ErrorRespuesta {
  error: { campo?: string; mensaje: string; productos?: string[] }
}
