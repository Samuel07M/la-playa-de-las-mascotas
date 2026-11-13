import { abrirBaseDeDatos, type BaseDeDatos } from '../db/connection'
import { crearApp } from '../app'
import { crearProducto } from '../modules/productos'
import { registrarMovimiento } from '../modules/movimientos'
import type { Categoria } from '../../shared/constantes'

export function nuevaDb(): BaseDeDatos {
  return abrirBaseDeDatos(':memory:')
}

export function nuevaApi(db = nuevaDb()) {
  return { db, app: crearApp(db) }
}

/** Crea un producto activo con un stock inicial (entrada INV-INICIAL). */
export function productoCon(
  db: BaseDeDatos,
  stockInicial = 0,
  datos: Partial<{ nombre: string; categoria: Categoria; precioVenta: number; stockMinimo: number }> = {}
): number {
  const p = crearProducto(db, {
    nombre: datos.nombre ?? 'Concentrado Dog Chow Adulto 8kg',
    categoria: datos.categoria ?? 'Alimento perros',
    precioVenta: datos.precioVenta ?? 62000,
    stockMinimo: datos.stockMinimo ?? 5
  })
  if (stockInicial > 0) {
    registrarMovimiento(db, {
      productoId: p.id,
      tipo: 'entrada',
      cantidad: stockInicial,
      motivo: 'Inventario inicial',
      referencia: 'INV-INICIAL'
    })
  }
  return p.id
}
