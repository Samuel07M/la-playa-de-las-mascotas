// HU-04 — Entrada de mercancía (vEnt, eSave del mockup).
import { useState } from 'react'
import { M } from '@shared/esquemas'
import { fd } from '@shared/formato'
import type { EntradaReciente, Producto, Proveedor } from '@shared/tipos'
import { api, ErrorDeApi } from '../api'
import { Encabezado, Er, useUi } from '../components/ui'
import { useMemoria } from '../memoria'
import { usarDatos } from '../usarDatos'

interface Linea {
  pid: string
  q: string
}
interface Errores {
  r?: string
  pv?: string
  l: (string | undefined)[]
}

export default function Entradas() {
  const { toast, huboCambios } = useUi()
  const activos = usarDatos<Producto[]>('/productos?activos=1')
  const recientes = usarDatos<EntradaReciente[]>('/entradas/recientes')
  // Proveedor opcional (agregado en la Fase 3 para el reporte de proveedores de HU-09).
  const proveedores = usarDatos<Proveedor[]>('/proveedores?activos=1')
  const [epv, setEpv] = useMemoria('ent.prov', '')
  const [eref, setEref] = useMemoria('ent.ref', '')
  const [ent, setEnt] = useMemoria<Linea[]>('ent.lineas', [{ pid: '', q: '' }])
  const [eErr, setEErr] = useState<Errores | null>(null)
  const E: Errores = eErr ?? { l: [] }

  const cambiar = (i: number, k: keyof Linea, v: string) => setEnt(ent.map((l, j) => (j === i ? { ...l, [k]: v } : l)))

  async function eSave() {
    const err: Errores = { l: [] }
    let bad = false
    if (!eref.trim()) {
      err.r = M.referencia
      bad = true
    }
    ent.forEach((l, i) => {
      const p = l.pid && activos?.find((x) => String(x.id) === l.pid)
      const n = Number(l.q)
      if (!p) err.l[i] = M.productoExistente
      else if (!Number.isInteger(n) || n <= 0) err.l[i] = M.cantidad
      if (err.l[i]) bad = true
    })
    if (bad) {
      setEErr(err)
      return toast('Revisa los campos marcados', true)
    }
    try {
      await api.post('/entradas', {
        referencia: eref.trim(),
        proveedorId: epv ? Number(epv) : null,
        lineas: ent.map((l) => ({ productoId: Number(l.pid), cantidad: Number(l.q) }))
      })
    } catch (e) {
      const x = e as ErrorDeApi
      const m = x.campo?.match(/^lineas\.(\d+)/)
      if (x.campo === 'referencia') setEErr({ r: x.message, l: [] })
      else if (x.campo === 'proveedorId') setEErr({ pv: x.message, l: [] })
      else if (m) setEErr({ l: Object.assign([], { [Number(m[1])]: x.message }) })
      return toast(x.campo ? 'Revisa los campos marcados' : x.message, true)
    }
    const n = ent.length
    setEref('')
    setEpv('')
    setEnt([{ pid: '', q: '' }])
    setEErr(null)
    toast(`Entrada registrada (${n} producto${n > 1 ? 's' : ''}). Stock actualizado.`)
    huboCambios()
  }

  return (
    <>
      <Encabezado titulo="Entrada de mercancía" sub="Registra lo recibido con su factura o remisión." />
      <div className="card" style={{ maxWidth: 720 }}>
        <label>
          Referencia de factura o remisión
          <input
            className={`in ${E.r ? 'bad' : ''}`}
            value={eref}
            placeholder="Ej: FAC-1042"
            onChange={(e) => setEref(e.target.value)}
          />
          <Er m={E.r} />
        </label>
        <label>
          Proveedor (opcional)
          <select className={`in ${E.pv ? 'bad' : ''}`} value={epv} onChange={(e) => setEpv(e.target.value)}>
            <option value="">Sin proveedor</option>
            {(proveedores ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          <Er m={E.pv} />
        </label>
        {ent.map((l, i) => (
          <div key={i} className="ln" style={{ gridTemplateColumns: '1fr 100px auto' }}>
            <div>
              <select className={`in ${E.l[i] ? 'bad' : ''}`} value={l.pid} onChange={(e) => cambiar(i, 'pid', e.target.value)}>
                <option value="">Producto…</option>
                {(activos ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              <Er m={E.l[i]} />
            </div>
            <input
              className="in"
              type="number"
              placeholder="Cant."
              value={l.q}
              onChange={(e) => cambiar(i, 'q', e.target.value)}
            />
            <button
              className="b dn"
              onClick={() => {
                if (ent.length > 1) setEnt(ent.filter((_, j) => j !== i))
                setEErr(null)
              }}
            >
              ✕
            </button>
          </div>
        ))}
        <div className="mf" style={{ justifyContent: 'space-between', marginTop: 14 }}>
          <button className="b" onClick={() => setEnt([...ent, { pid: '', q: '' }])}>
            + Agregar otro producto
          </button>
          <button className="b pri" onClick={eSave}>
            Registrar entrada
          </button>
        </div>
      </div>
      <div className="card" style={{ maxWidth: 720 }}>
        <b>Últimas entradas</b>
        {recientes === null ? null : recientes.length ? (
          recientes.map((r) => (
            <div key={r.referencia} className="ln" style={{ gridTemplateColumns: '90px 1fr auto' }}>
              <b>{r.referencia}</b>
              <span>{r.productos.map((x) => x.nombre + ' ×' + x.cantidad).join(', ')}</span>
              <small>{fd(r.fecha)}</small>
            </div>
          ))
        ) : (
          <p className="sub">Aún no hay entradas registradas.</p>
        )}
      </div>
    </>
  )
}
