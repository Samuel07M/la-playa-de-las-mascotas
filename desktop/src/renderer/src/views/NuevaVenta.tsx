// HU-03 — Nueva venta (vSale, grid, cartR, sell, doSell del mockup).
import { useState } from 'react'
import { M } from '@shared/esquemas'
import { money } from '@shared/formato'
import type { MetodoPago } from '@shared/constantes'
import type { Producto, VentaRegistrada } from '@shared/tipos'
import { cantidadDe, cronometro, totalVenta } from '@shared/venta'
import { api, ErrorDeApi } from '../api'
import { Encabezado, useUi } from '../components/ui'
import { useMemoria } from '../memoria'
import { usarDatos } from '../usarDatos'

interface Linea {
  pid: number
  q: number
}

const PAGOS: [MetodoPago, string][] = [
  ['efectivo', 'Efectivo'],
  ['digital', 'Digital']
]

export default function NuevaVenta() {
  const { ask, toast, huboCambios } = useUi()
  const productos = usarDatos<Producto[]>('/productos')
  const [sq, setSq] = useMemoria('sale.sq', '')
  const [cart, setCart] = useMemoria<Linea[]>('sale.cart', [])
  const [pay, setPay] = useMemoria<MetodoPago>('sale.pay', 'efectivo')
  const [t0, setT0] = useMemoria<number | null>('sale.t0', null)
  const [enviando, setEnviando] = useState(false)

  // El cronómetro ya no se muestra en el recuadro, pero sigue midiendo cada venta: su tiempo
  // aparece en el mensaje de confirmación (indicador de 4 minutos, PLAN §8).

  const prod = (id: number) => productos?.find((p) => p.id === id)
  const s = sq.trim().toLowerCase()
  const visibles = (productos ?? [])
    .filter((p) => p.activo)
    .filter(
      (p) =>
        !s || (p.nombre + ' ' + p.categoria + ' ' + p.alias.map((a) => a.texto).join(' ')).toLowerCase().includes(s)
    )
  const lineas = cart.filter((r) => prod(r.pid))
  const tot = totalVenta(lineas.map((r) => ({ cantidad: r.q, precio: prod(r.pid)!.precioVenta })))

  function add(id: number) {
    const i = cart.findIndex((x) => x.pid === id)
    setCart(i >= 0 ? cart.map((x, j) => (j === i ? { ...x, q: x.q + 1 } : x)) : [...cart, { pid: id, q: 1 }])
    if (!t0) setT0(Date.now())
  }
  const setQ = (i: number, v: string | number) =>
    setCart(cart.map((x, j) => (j === i ? { ...x, q: cantidadDe(v) } : x)))
  function quitar(i: number) {
    const c = cart.filter((_, j) => j !== i)
    setCart(c)
    if (!c.length) setT0(null)
  }

  async function doSell(confirmar: boolean) {
    if (enviando) return
    setEnviando(true)
    try {
      const v = await api.post<VentaRegistrada>('/ventas', {
        metodoPago: pay,
        lineas: cart.map((r) => ({ productoId: r.pid, cantidad: r.q })),
        confirmarSobreStock: confirmar
      })
      const t = cronometro(t0)
      setCart([])
      setT0(null)
      toast(`Venta ${v.consecutivo} registrada en ${t}. Stock actualizado.`)
      huboCambios()
    } catch (e) {
      const x = e as ErrorDeApi
      // Supera el stock: se advierte y se exige confirmación (no se bloquea).
      if (x.status === 409 && x.productos) ask(M.sobreStock(x.productos), () => doSell(true))
      else toast(x.message, true)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <Encabezado titulo="Nueva venta" sub="Selecciona productos, cantidades y método de pago." />
      <div className="g2">
        <div className="card">
          <input
            className="in"
            placeholder="Buscar producto o alias…"
            value={sq}
            onChange={(e) => setSq(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          <div className="pg" id="sg">
            {productos === null ? null : visibles.length ? (
              visibles.map((p) => (
                <button key={p.id} className="pc" onClick={() => add(p.id)}>
                  <b>{p.nombre}</b>
                  <span>
                    {money(p.precioVenta)} · stock {p.stock}
                  </span>
                </button>
              ))
            ) : (
              <p className="sub">Sin resultados.</p>
            )}
          </div>
        </div>
        <div className="card" id="cart">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <b>Venta actual</b>
          </div>
          {cart.length ? (
            cart.map((r, i) => {
              const p = prod(r.pid)
              if (!p) return null
              return (
                <div key={r.pid} className="ln">
                  <div>
                    <b>{p.nombre}</b>
                    <small style={{ color: 'var(--mu)' }}>{money(p.precioVenta)} c/u</small>
                    {r.q > p.stock ? <span className="er">⚠ Supera el stock disponible ({p.stock}).</span> : null}
                  </div>
                  <div className="qty">
                    <button className="b" onClick={() => setQ(i, r.q - 1)}>
                      −
                    </button>
                    <input
                      key={`${r.pid}-${r.q}`}
                      className="in"
                      defaultValue={r.q}
                      onBlur={(e) => setQ(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                      }}
                    />
                    <button className="b" onClick={() => setQ(i, r.q + 1)}>
                      +
                    </button>
                  </div>
                  <b>{money(r.q * p.precioVenta)}</b>
                  <button className="b dn" onClick={() => quitar(i)}>
                    ✕
                  </button>
                </div>
              )
            })
          ) : (
            <p className="sub" style={{ marginTop: 12 }}>
              Toca un producto para agregarlo.
            </p>
          )}
          <div className="tot">
            <span>Total</span>
            <span>{money(tot)}</span>
          </div>
          <div className="row2">
            {PAGOS.map(([m, t]) => (
              <button key={m} className={`b ${pay === m ? 'pri' : ''}`} onClick={() => setPay(m)}>
                {t}
              </button>
            ))}
          </div>
          <button
            className="b pri"
            style={{ width: '100%', padding: 12 }}
            disabled={!cart.length}
            onClick={() => doSell(false)}
          >
            Confirmar venta
          </button>
        </div>
      </div>
    </>
  )
}
