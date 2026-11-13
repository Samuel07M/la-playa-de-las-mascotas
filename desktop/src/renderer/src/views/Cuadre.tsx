// HU-08 — Cuadre de caja. Sin mockup: solo componentes y clases del mockup.
import { useState } from 'react'
import { cuadreSchema, erroresPorCampo, numeroDe } from '@shared/esquemas'
import { fd, fdia, hoyColombia, money } from '@shared/formato'
import type { Cuadre as TCuadre, DiaCaja } from '@shared/tipos'
import { api, ErrorDeApi, qs } from '../api'
import { Encabezado, Er, useUi } from '../components/ui'
import { useMemoria } from '../memoria'
import { usarDatos } from '../usarDatos'

/** Texto y color de la diferencia: contado − esperado en efectivo. */
function Diferencia({ d }: { d: number }) {
  if (d === 0) return <div className="alert ok">✓ Diferencia: {money(0)}. La caja cuadra.</div>
  return d < 0 ? (
    <div className="alert rd">⚠ Diferencia: −{money(-d)}. Falta efectivo frente a lo vendido.</div>
  ) : (
    <div className="alert bl">Diferencia: +{money(d)}. Sobra efectivo frente a lo vendido.</div>
  )
}

const fmtDif = (d: number) => (d === 0 ? money(0) : (d > 0 ? '+' : '−') + money(Math.abs(d)))

export default function Cuadre() {
  const { toast, huboCambios } = useUi()
  const [dia, setDia] = useMemoria('caja.dia', hoyColombia)
  const t = usarDatos<DiaCaja>('/cuadres/dia' + qs({ fecha: dia }))
  const lista = usarDatos<TCuadre[]>('/cuadres')
  const [contado, setContado] = useState('')
  const [calculada, setCalculada] = useState<number | null>(null)
  const [err, setErr] = useState('')

  const actual = t && t.dia === dia ? t : null

  function cambiarDia(v: string) {
    setDia(v || hoyColombia())
    setContado('')
    setCalculada(null)
    setErr('')
  }

  function validarContado(): number | null {
    const r = cuadreSchema.safeParse({ dia, efectivoContado: numeroDe(contado) })
    if (!r.success) {
      setErr(erroresPorCampo(r.error).efectivoContado ?? '')
      setCalculada(null)
      return null
    }
    setErr('')
    return r.data.efectivoContado
  }

  function calcular() {
    const n = validarContado()
    if (n !== null && actual) setCalculada(n - actual.totalEfectivo)
  }

  async function guardar() {
    const n = validarContado()
    if (n === null) return
    try {
      await api.post('/cuadres', { dia, efectivoContado: n })
    } catch (e) {
      const x = e as ErrorDeApi
      if (x.campo === 'efectivoContado') setErr(x.message)
      return toast(x.message, true)
    }
    setContado('')
    setCalculada(null)
    toast(`Cuadre del ${fdia(dia)} guardado`)
    huboCambios()
  }

  return (
    <>
      <Encabezado titulo="Cuadre de caja" sub="Compara lo vendido en el día con el efectivo contado." />
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
                    Cuadre guardado el {fd(actual.cuadre.creadoEn)} por {actual.cuadre.usuario}. Efectivo contado:{' '}
                    <b>{money(actual.cuadre.efectivoContado)}</b>.
                  </div>
                  <Diferencia d={actual.cuadre.diferencia} />
                </>
              ) : (
                <>
                  <label>
                    Efectivo contado (COP)
                    <input
                      className={`in ${err ? 'bad' : ''}`}
                      type="number"
                      value={contado}
                      onChange={(e) => {
                        setContado(e.target.value)
                        setCalculada(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') calcular()
                      }}
                    />
                    <Er m={err} />
                  </label>
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
            <table className="tb">
              <tbody>
                <tr>
                  <th>Día</th>
                  <th>Esperado</th>
                  <th>Contado</th>
                  <th>Diferencia</th>
                  <th>Usuario</th>
                </tr>
                {lista.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <button className="b" onClick={() => cambiarDia(c.dia)}>
                        {fdia(c.dia)}
                      </button>
                    </td>
                    <td>{money(c.totalEfectivo)}</td>
                    <td>{money(c.efectivoContado)}</td>
                    <td>
                      <span className={`tag ${c.diferencia === 0 ? 'ok' : c.diferencia < 0 ? 'rd' : 'bl'}`} style={{ whiteSpace: 'nowrap' }}>
                        {fmtDif(c.diferencia)}
                      </span>
                    </td>
                    <td>{c.usuario}</td>
                  </tr>
                ))}
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
