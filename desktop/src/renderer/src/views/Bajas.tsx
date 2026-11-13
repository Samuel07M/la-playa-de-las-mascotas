// HU-05 — Bajas de mercancía (vBaj, bSave del mockup).
import { useState } from 'react'
import { MOTIVOS_BAJA } from '@shared/constantes'
import { M } from '@shared/esquemas'
import { capitalizar, fd, money } from '@shared/formato'
import type { Movimiento, Producto, ResumenBaja } from '@shared/tipos'
import { api, ErrorDeApi } from '../api'
import { Encabezado, Er, useUi } from '../components/ui'
import { useMemoria } from '../memoria'
import { usarDatos } from '../usarDatos'

type Errores = Partial<Record<'p' | 'q' | 'm', string>>
const CAMPO: Record<string, keyof Errores> = { productoId: 'p', cantidad: 'q', motivo: 'm' }
const VACIA = { pid: '', q: '', mo: '', n: '' }

export default function Bajas() {
  const { toast, huboCambios } = useUi()
  const activos = usarDatos<Producto[]>('/productos?activos=1')
  const bs = usarDatos<Movimiento[]>('/bajas')
  const sm = usarDatos<ResumenBaja[]>('/bajas/resumen')
  const [bj, setBj] = useMemoria('baj.form', VACIA)
  const [E, setE] = useState<Errores>({})
  const cambiar = (k: keyof typeof VACIA) => (e: { target: { value: string } }) => setBj({ ...bj, [k]: e.target.value })

  async function bSave() {
    const e: Errores = {}
    const p = bj.pid ? activos?.find((x) => String(x.id) === bj.pid) : undefined
    const n = Number(bj.q)
    if (!p) e.p = M.productoBaja
    if (!bj.mo) e.m = M.motivoBaja
    if (!Number.isInteger(n) || n <= 0) e.q = M.cantidad
    else if (p && n > p.stock) e.q = M.bajaSuperaStock(p.stock)
    setE(e)
    if (Object.keys(e).length) return toast('No se pudo registrar la baja', true)
    try {
      await api.post('/bajas', { productoId: p!.id, cantidad: n, motivo: bj.mo, detalle: bj.n.trim() })
    } catch (ex) {
      const x = ex as ErrorDeApi
      if (x.campo && CAMPO[x.campo]) {
        setE({ [CAMPO[x.campo]]: x.message })
        return toast('No se pudo registrar la baja', true)
      }
      return toast(x.message, true)
    }
    setBj(VACIA)
    setE({})
    toast('Baja registrada. Stock actualizado.')
    huboCambios()
  }

  return (
    <>
      <Encabezado titulo="Bajas de mercancía" sub="Descuenta stock por vencimiento, daño u otro motivo." />
      <div className="g2">
        <div className="card">
          <label>
            Producto
            <select className={`in ${E.p ? 'bad' : ''}`} value={bj.pid} onChange={cambiar('pid')}>
              <option value="">Seleccionar…</option>
              {(activos ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} (stock {p.stock})
                </option>
              ))}
            </select>
            <Er m={E.p} />
          </label>
          <label>
            Cantidad
            <input className={`in ${E.q ? 'bad' : ''}`} type="number" value={bj.q} onChange={cambiar('q')} />
            <Er m={E.q} />
          </label>
          <label>
            Motivo
            <select className={`in ${E.m ? 'bad' : ''}`} value={bj.mo} onChange={cambiar('mo')}>
              <option value="">Seleccionar…</option>
              {MOTIVOS_BAJA.map((m) => (
                <option key={m} value={m}>
                  {capitalizar(m)}
                </option>
              ))}
            </select>
            <Er m={E.m} />
          </label>
          <label>
            Detalle (opcional)
            <input className="in" value={bj.n} onChange={cambiar('n')} />
          </label>
          <button className="b pri" style={{ width: '100%', padding: 11 }} onClick={bSave}>
            Registrar baja
          </button>
        </div>
        <div className="card">
          <b>Pérdidas por motivo</b>
          <small style={{ color: 'var(--mu)', display: 'block' }}>Valoradas a precio de venta</small>
          {sm === null ? null : sm.length ? (
            sm.map((v) => (
              <div key={v.motivo} className="ln" style={{ gridTemplateColumns: '1fr auto auto' }}>
                <span className="tag rd" style={{ justifySelf: 'start' }}>
                  {capitalizar(v.motivo)}
                </span>
                <span>{v.cantidad} u.</span>
                <b>{money(v.valor)}</b>
              </div>
            ))
          ) : (
            <p className="sub">Sin bajas registradas.</p>
          )}
        </div>
      </div>
      <div className="card wrap">
        <b>Historial de bajas</b>
        <table className="tb">
          <tbody>
            <tr>
              <th>Fecha</th>
              <th>Producto</th>
              <th>Cant.</th>
              <th>Motivo</th>
              <th>Usuario</th>
            </tr>
            {(bs ?? []).map((x) => (
              <tr key={x.id}>
                <td>{fd(x.fecha)}</td>
                <td>{x.producto}</td>
                <td>{x.cantidad}</td>
                <td>
                  {capitalizar(x.motivo)}
                  {x.detalle ? ' · ' + x.detalle : ''}
                </td>
                <td>{x.usuario}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
