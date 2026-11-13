import type { BaseDeDatos } from '../db/connection'
import { USUARIO } from '../../shared/constantes'
import { M, type VentaEntrada } from '../../shared/esquemas'
import type { VentaRegistrada } from '../../shared/tipos'
import { ErrorApi } from '../errores'
import { registrarMovimiento, stockDe } from './movimientos'
import { exigirActivo } from './productos'

/** Siguiente consecutivo: V-001, V-002… (sigue al mayor existente). */
export function siguienteConsecutivo(db: BaseDeDatos): string {
  const r = db
    .prepare(`SELECT MAX(CAST(substr(consecutivo, 3) AS INTEGER)) AS n FROM ventas`)
    .get() as { n: number | null }
  return 'V-' + String((r.n ?? 0) + 1).padStart(3, '0')
}

/**
 * Registra una venta: un movimiento "venta" por línea, con el precio vigente.
 * Si alguna línea supera el stock y no viene confirmarSobreStock, lanza 409 con la
 * lista de productos afectados (no se bloquea: se exige confirmación).
 */
export function registrarVenta(
  db: BaseDeDatos,
  v: VentaEntrada,
  opciones: { fecha?: string; consecutivo?: string } = {}
): VentaRegistrada {
  return db.transaction(() => {
    const productos = v.lineas.map((l, i) =>
      exigirActivo(db, l.productoId, M.productoExistente, `lineas.${i}.productoId`)
    )
    // Cantidad total pedida por producto (por si un producto viene en varias líneas).
    const pedido = new Map<number, number>()
    v.lineas.forEach((l) => pedido.set(l.productoId, (pedido.get(l.productoId) ?? 0) + l.cantidad))
    const superan = [...pedido]
      .filter(([id, q]) => q > stockDe(db, id))
      .map(([id]) => productos.find((p) => p.id === id)!.nombre)
    if (superan.length && !v.confirmarSobreStock) {
      throw new ErrorApi(409, M.sobreStock(superan), undefined, { productos: superan })
    }
    const fecha = opciones.fecha ?? new Date().toISOString()
    const consecutivo = opciones.consecutivo ?? siguienteConsecutivo(db)
    const ventaId = Number(
      db
        .prepare(`INSERT INTO ventas (consecutivo, metodo_pago, usuario, fecha) VALUES (?, ?, ?, ?)`)
        .run(consecutivo, v.metodoPago, USUARIO, fecha).lastInsertRowid
    )
    let total = 0
    v.lineas.forEach((l, i) => {
      const p = productos[i]
      total += l.cantidad * p.precioVenta
      registrarMovimiento(db, {
        productoId: p.id,
        tipo: 'venta',
        cantidad: l.cantidad,
        motivo: v.metodoPago,
        referencia: consecutivo,
        ventaId,
        precioUnitario: p.precioVenta,
        fecha
      })
    })
    return { id: ventaId, consecutivo, metodoPago: v.metodoPago, total }
  })()
}
