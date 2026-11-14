import type { BaseDeDatos } from '../db/connection'
import { USUARIO } from '../../shared/constantes'
import type { FastifyInstance } from 'fastify'
import { M, ventaSchema, type VentaEntrada } from '../../shared/esquemas'
import type { ProductoSinStock, VentaRegistrada } from '../../shared/tipos'
import { ErrorApi, validar } from '../errores'
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
 * Productos cuya cantidad pedida supera el stock actual, con su stock disponible.
 * Suma las líneas repetidas del mismo producto antes de comparar.
 */
export function faltantesDeStock(
  db: BaseDeDatos,
  lineas: { productoId: number; cantidad: number }[]
): ProductoSinStock[] {
  const pedido = new Map<number, number>()
  lineas.forEach((l) => pedido.set(l.productoId, (pedido.get(l.productoId) ?? 0) + l.cantidad))
  const nombre = db.prepare(`SELECT nombre FROM productos WHERE id = ?`)
  return [...pedido].flatMap(([id, q]) => {
    const disponible = stockDe(db, id)
    if (q <= disponible) return []
    return [{ nombre: (nombre.get(id) as { nombre: string }).nombre, disponible }]
  })
}

/**
 * Registra una venta: un movimiento "venta" por línea, con el precio vigente.
 * Si alguna línea (sumando las repetidas) supera el stock, la venta se RECHAZA con 400 y no
 * se registra ninguna línea: el stock nunca queda negativo. La verificación se hace dentro de la
 * misma transacción del registro.
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
    const faltantes = faltantesDeStock(db, v.lineas)
    if (faltantes.length) {
      throw new ErrorApi(400, M.ventaSinStock(faltantes), undefined, { productos: faltantes })
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

export function rutasVentas(app: FastifyInstance, db: BaseDeDatos): void {
  app.post('/ventas', async (req, reply) => {
    return reply.code(201).send(registrarVenta(db, validar(ventaSchema, req.body)))
  })
}
