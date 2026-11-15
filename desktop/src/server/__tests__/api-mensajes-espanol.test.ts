import { describe, expect, it } from 'vitest'
import { nuevaApi, productoCon } from './ayudas'

/** Palabras de los mensajes por defecto de Zod en inglés (o tipos técnicos que no entiende Isabel). */
const INGLES = /\b(invalid|expected|received|required|option|must|string|number|array|object|boolean|undefined|NaN)\b/i

type Caso = [string, 'GET' | 'POST' | 'PATCH', string, unknown?, string?]

// [descripción, método, url, cuerpo, mensaje esperado (si se conoce)]
const CASOS: Caso[] = [
  ['venta con método de pago inválido', 'POST', '/ventas', { metodoPago: 'tarjeta', lineas: [{ productoId: 1, cantidad: 1 }] }, 'Selecciona un método de pago: efectivo o digital.'],
  ['venta sin método de pago', 'POST', '/ventas', { lineas: [{ productoId: 1, cantidad: 1 }] }, 'Selecciona un método de pago: efectivo o digital.'],
  ['venta con líneas que no son lista', 'POST', '/ventas', { metodoPago: 'efectivo', lineas: 'dos' }, 'Selecciona un producto existente.'],
  ['venta con una línea que no es objeto', 'POST', '/ventas', { metodoPago: 'efectivo', lineas: ['x'] }, 'Selecciona un producto existente.'],
  ['baja con motivo inválido', 'POST', '/bajas', { productoId: 1, cantidad: 1, motivo: 'robado' }, 'Debes seleccionar un motivo para guardar.'],
  ['baja con detalle que no es texto', 'POST', '/bajas', { productoId: 1, cantidad: 1, motivo: 'otro', detalle: 5 }, 'Escribe un texto válido.'],
  ['producto con categoría inválida', 'POST', '/productos', { nombre: 'X', categoria: 'Peces', precioVenta: 1000, stockMinimo: 0 }, 'Selecciona una categoría.'],
  ['producto con precio en texto', 'POST', '/productos', { nombre: 'X', categoria: 'Otros', precioVenta: 'mil', stockMinimo: 0 }, 'El precio debe ser mayor que 0.'],
  ['activar producto con valor que no es sí/no', 'PATCH', '/productos/1/activo', { activo: 'si' }, 'Indica si queda activo o inactivo.'],
  ['filtro de activos inválido', 'GET', '/productos?activos=2', undefined, 'El filtro de activos debe ser 0 o 1.'],
  ['historial con producto inválido', 'GET', '/movimientos?productoId=abc', undefined, 'Selecciona un producto existente.'],
  ['entrada con líneas que no son lista', 'POST', '/entradas', { referencia: 'FAC-1', lineas: 5 }, 'Selecciona un producto existente.'],
  ['proveedor con teléfono que no es texto', 'POST', '/proveedores', { nombre: 'Distribuidora', telefono: 300 }, 'Escribe un texto válido.'],
  ['cuadre con día inválido', 'POST', '/cuadres', { dia: 'hoy', efectivoContado: 0, digitalContado: 0 }, 'Selecciona una fecha.'],
  ['reporte con fecha inválida', 'GET', '/reportes/rotacion?desde=x&hasta=2026-11-14', undefined, 'Selecciona una fecha.'],
  ['cuerpo que no es JSON válido', 'POST', '/ventas', '{malo', undefined]
]

describe('API · los errores 400 se responden en español', () => {
  it.each(CASOS)('%s', async (_d, method, url, cuerpo, esperado) => {
    const { app, db } = nuevaApi()
    productoCon(db, 5)
    const r = await app.inject({
      method,
      url,
      ...(cuerpo === undefined
        ? {}
        : typeof cuerpo === 'string'
          ? { payload: cuerpo, headers: { 'content-type': 'application/json' } }
          : { payload: cuerpo as object })
    })
    expect(r.statusCode).toBe(400)
    const mensaje = r.json().error.mensaje as string
    expect(mensaje).not.toMatch(INGLES)
    if (esperado) expect(mensaje).toBe(esperado)
  })
})
