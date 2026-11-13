import type { Categoria, MetodoPago, Rotacion, TipoMovimiento } from './constantes'

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

// HU-07
export interface Proveedor {
  id: number
  nombre: string
  telefono: string | null
  correo: string | null
  activo: boolean
  /** Cantidad de precios registrados en su historial. */
  precios: number
}

export interface PrecioProveedor {
  id: number
  proveedorId: number
  proveedor: string
  productoId: number
  producto: string
  precio: number
  /** Día del precio, AAAA-MM-DD. */
  fecha: string
}

// HU-08
export interface DiaCaja {
  dia: string
  ventas: number
  totalEfectivo: number
  totalDigital: number
  total: number
  /** Cuadre ya guardado para ese día, si existe. */
  cuadre: Cuadre | null
}

export interface Cuadre {
  id: number
  dia: string
  totalEfectivo: number
  totalDigital: number
  efectivoContado: number
  diferencia: number
  usuario: string
  creadoEn: string
}

// HU-09
export interface FilaRotacion {
  id: number
  nombre: string
  categoria: string
  vendidas: number
  stock: number
  rotacion: Rotacion
}

export interface TopProducto {
  id: number
  nombre: string
  cantidad: number
  valor: number
}

export interface TopProveedor {
  id: number
  nombre: string
  entradas: number
  unidades: number
  valor: number
}

// HU-15
export interface Mensaje {
  id: number
  texto: string
  usuario: string
  fecha: string
  estado: 'confirmado' | 'corregido' | 'no_entendido'
  revisado: boolean
  productoId: number | null
  producto: string | null
  aliasTexto: string | null
}
