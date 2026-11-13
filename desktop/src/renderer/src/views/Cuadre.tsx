// HU-08 — Cuadre de caja. Sin mockup: solo componentes y clases del mockup.
// Compara el monto total contado (efectivo + digital) con el total vendido (docs/PREGUNTAS.md, 25).
import { useState } from 'react'
import { cuadreSchema, erroresPorCampo, numeroDe } from '@shared/esquemas'
import { fd, fdia, hoyColombia, money } from '@shared/formato'
import type { Cuadre as TCuadre, DiaCaja } from '@shared/tipos'
import { api, ErrorDeApi, qs } from '../api'
import { Encabezado, Er, useUi } from '../components/ui'
import { useMemoria } from '../memoria'
import { usarDatos } from '../usarDatos'

/** Texto y color de la diferencia: monto total contado − total vendido. */
function Diferencia({ d }: { d: number }) {
  if (d === 0) return <div className="alert ok">✓ Diferencia: {money(0)}. La caja cuadra.</div>
  return d < 0 ? (
    <div className="alert rd">⚠ Diferencia: −{money(-d)}. Falta dinero frente a lo vendido.</div>
  ) : (
    <div className="alert bl">Diferencia: +{money(d)}. Sobra dinero frente a lo vendido.</div>
  )
}

const fmtDif = (d: number) => (d === 0 ? money(0) : (d > 0 ? '+' : '−') + money(Math.abs(d)))

/** Vendido y contado de un cuadre guardado (los anteriores al esquema v3 solo comparaban efectivo). */
const montos = (c: TCuadre) =>
  c.digitalContado === null
    ? { vendido: c.totalEfectivo, contado: c.efectivoContado }
    : {
        vendido: c.totalEfectivo + c.totalDigital,
        contado: c.efectivoContado + c.digitalContado
      }

type Campo = 'efectivoContado' | 'digitalContado'
const VACIO = { efectivoContado: '', digitalContado: '' }

export default function Cuadre() {
  const { toast, huboCambios } = useUi()
  const [dia, setDia] = useMemoria('caja.dia', hoyColombia)
  const t = usarDatos<DiaCaja>('/cuadres/dia' + qs({ fecha: dia }))
  const lista = usarDatos<TCuadre[]>('/cuadres')
  const [v, setV] = useState(VACIO)
  const [calculada, setCalculada] = useState<number | null>(null)
  const [err, setErr] = useState<Partial<Record<Campo, string>>>({})

  const actual = t && t.dia === dia ? t : null

  function cambiarDia(d: string) {
    setDia(d || hoyColombia())
    setV(VACIO)
    setCalculada(null)
    setErr({})
  }

  function validar(): {
    efectivoContado: number
    digitalContado: number
  } | null {
    const r = cuadreSchema.safeParse({
      dia,
      efectivoContado: numeroDe(v.efectivoContado),
      digitalContado: numeroDe(v.digitalContado)
    })
    if (!r.success) {
      const e = erroresPorCampo(r.error)
      setErr({
        efectivoContado: e.efectivoContado,
        digitalContado: e.digitalContado
      })
      setCalculada(null)
      return null
    }
    setErr({})
    return r.data
  }

  function calcular() {
    const n = validar()
    if (n && actual) setCalculada(n.efectivoContado + n.digitalContado - actual.total)
  }

  async function guardar() {
    const n = validar()
    if (!n) return
    try {
      await api.post('/cuadres', { dia, ...n })
    } catch (e) {
      const x = e as ErrorDeApi
      if (x.campo === 'efectivoContado' || x.campo === 'digitalContado') setErr({ [x.campo]: x.message })
      return toast(x.message, true)
    }
    setV(VACIO)
    setCalculada(null)
    toast(`Cuadre del ${fdia(dia)} guardado`)
    huboCambios()
  }

  const campo = (k: Campo, titulo: string) => (
    <label style={{ margin: 0 }}>
      {titulo}
      <input
        className={`in ${err[k] ? 'bad' : ''}`}
        type="number"
        value={v[k]}
        onChange={(e) => {
          setV({ ...v, [k]: e.target.value })
          setCalculada(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') calcular()
        }}
      />
      <Er m={err[k]} />
    </label>
  )

  return (
    <>
      <Encabezado
        titulo="Cuadre de caja"
        sub="Compara lo vendido en el día con el dinero contado en efectivo y digital."
      />
      <div className="g2">
        <div className="card">
          <label>
            Día
            <input className="in" type="date" value={dia} onChange={(e) => cambiarDia(e.target.value)} />
          </label>
          {actual ? (
            <>
              <div className="ln" style={{ gridTemplateColumns: '1fr auto' }}>
                <span>Ventas en efectivo</span>
                <b>{money(actual.totalEfectivo)}</b>
              </div>
              <div className="ln" style={{ gridTemplateColumns: '1fr auto' }}>
                <span>Ventas digitales</span>
                <b>{money(actual.totalDigital)}</b>
              </div>
              <div className="tot">
                <span>Total vendido</span>
                <span>{money(actual.total)}</span>
              </div>
              <p className="sub">
                {actual.ventas
                  ? `${actual.ventas} venta${actual.ventas > 1 ? 's' : ''} registrada${actual.ventas > 1 ? 's' : ''} este día.`
                  : 'No hay ventas registradas este día.'}
              </p>
              {actual.cuadre ? (
                <>
                  <div className="alert bl">
                    Cuadre guardado el {fd(actual.cuadre.creadoEn)} por {actual.cuadre.usuario}. Monto total contado:{' '}
                    <b>{money(montos(actual.cuadre).contado)}</b>
                    {actual.cuadre.digitalContado === null
                      ? ' (solo efectivo).'
                      : ` (efectivo ${money(actual.cuadre.efectivoContado)} + digital ${money(actual.cuadre.digitalContado)}).`}
                  </div>
                  <Diferencia d={actual.cuadre.diferencia} />
                </>
              ) : (
                <>
                  <div className="row2">
                    {campo('efectivoContado', 'Efectivo contado (COP)')}
                    {campo('digitalContado', 'Digital recibido (COP)')}
                  </div>
                  {calculada !== null ? <Diferencia d={calculada} /> : null}
                  <div className="mf">
                    <button className="b" onClick={calcular}>
                      Calcular diferencia
                    </button>
                    <button className="b pri" disabled={calculada === null} onClick={guardar}>
                      Guardar cuadre
                    </button>
                  </div>
                </>
              )}
            </>
          ) : null}
        </div>
        <div className="card wrap">
          <b>Cuadres guardados</b>
          {lista === null ? null : lista.length ? (
            <table className="tb" style={{ fontSize: 13 }}>
              <tbody>
                <tr>
                  <th>Día</th>
                  <th>Vendido</th>
                  <th>Contado</th>
                  <th>Diferencia</th>
                  <th>Usuario</th>
                </tr>
                {lista.map((c) => {
                  const m = montos(c)
                  return (
                    <tr key={c.id}>
                      <td>
                        <button className="b" style={{ padding: '3px 8px' }} onClick={() => cambiarDia(c.dia)}>
                          {fdia(c.dia)}
                        </button>
                      </td>
                      <td>{money(m.vendido)}</td>
                      <td>{money(m.contado)}</td>
                      <td>
                        <span
                          className={`tag ${c.diferencia === 0 ? 'ok' : c.diferencia < 0 ? 'rd' : 'bl'}`}
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          {fmtDif(c.diferencia)}
                        </span>
                      </td>
                      <td>{c.usuario}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <p className="sub">Aún no hay cuadres guardados.</p>
          )}
        </div>
      </div>
    </>
  )
}
