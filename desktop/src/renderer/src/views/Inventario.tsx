// HU-06 — Inventario (vInv, mvList del mockup).
import { fd, capitalizar } from '@shared/formato'
import type { FilaInventario, Movimiento, Producto, Verificacion } from '@shared/tipos'
import { qs } from '../api'
import { Encabezado } from '../components/ui'
import { useMemoria } from '../memoria'
import { usarDatos } from '../usarDatos'

const T = { entrada: 'ok', venta: 'bl', baja: 'rd' } as const

export default function Inventario() {
  const filas = usarDatos<FilaInventario[]>('/inventario')
  const productos = usarDatos<Producto[]>('/productos')
  const [mf, setMf] = useMemoria('inv.filtro', { pid: '', from: '', to: '' })
  const L = (filas ?? []).filter((r) => r.bajoMinimo)

  function verMovimientos(id: number) {
    setMf({ ...mf, pid: String(id) })
    document.getElementById('mvc')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <Encabezado titulo="Inventario" sub="Stock actual, alertas e historial de movimientos." />
      {filas === null ? null : L.length ? (
        <div className="alert rd">
          ⚠ {L.length} producto{L.length > 1 ? 's' : ''} por debajo del stock mínimo: {L.map((p) => p.nombre).join(', ')}.
        </div>
      ) : (
        <div className="alert ok">✓ Todos los productos están por encima del mínimo.</div>
      )}
      <div className="card wrap">
        <table className="tb">
          <tbody>
            <tr>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Stock</th>
              <th>Mínimo</th>
              <th>Estado</th>
              <th></th>
            </tr>
            {(filas ?? []).map((p) => (
              <tr key={p.id} className={p.bajoMinimo ? 'low' : ''}>
                <td>
                  <b>{p.nombre}</b>
                </td>
                <td>{p.categoria}</td>
                <td>
                  <b>{p.stock}</b>
                </td>
                <td>{p.stockMinimo}</td>
                <td>
                  {p.bajoMinimo ? <span className="tag rd">Reabastecer</span> : <span className="tag ok">OK</span>}
                </td>
                <td>
                  <button className="b" onClick={() => verMovimientos(p.id)}>
                    Ver movimientos
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card" id="mvc">
        <b>Historial de movimientos</b>
        <div className="bar" style={{ margin: '10px 0' }}>
          <select className="in" value={mf.pid} onChange={(e) => setMf({ ...mf, pid: e.target.value })}>
            <option value="">Todos los productos</option>
            {(productos ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          <input className="in" type="date" value={mf.from} onChange={(e) => setMf({ ...mf, from: e.target.value })} />
          <input className="in" type="date" value={mf.to} onChange={(e) => setMf({ ...mf, to: e.target.value })} />
        </div>
        <div className="wrap" id="mv">
          <MvList pid={mf.pid} from={mf.from} to={mf.to} />
        </div>
      </div>
    </>
  )
}

function MvList({ pid, from, to }: { pid: string; from: string; to: string }) {
  const r = usarDatos<Movimiento[]>('/movimientos' + qs({ productoId: pid, desde: from, hasta: to }))
  const v = usarDatos<Verificacion>(pid ? `/inventario/${pid}/verificacion` : null)
  return (
    <>
      {pid && v && String(v.productoId) === pid ? (
        <div className={`alert ${v.coinciden ? 'ok' : 'rd'}`}>
          Entradas − ventas − bajas = <b>{v.sumaMovimientos}</b> · Stock mostrado = <b>{v.stockMostrado}</b>{' '}
          {v.coinciden ? '✓ coinciden' : '✗ no coinciden'}
        </div>
      ) : null}
      {r === null ? null : r.length ? (
        <table className="tb">
          <tbody>
            <tr>
              <th>Fecha</th>
              <th>Producto</th>
              <th>Tipo</th>
              <th>Cant.</th>
              <th>Motivo / referencia</th>
              <th>Usuario</th>
            </tr>
            {r.map((x) => {
              const ref = x.referencia ?? x.detalle
              return (
                <tr key={x.id}>
                  <td>{fd(x.fecha)}</td>
                  <td>{x.producto}</td>
                  <td>
                    <span className={`tag ${T[x.tipo]}`}>{x.tipo}</span>
                  </td>
                  <td>
                    <b>
                      {x.tipo === 'entrada' ? '+' : '−'}
                      {x.cantidad}
                    </b>
                  </td>
                  <td>
                    {capitalizar(x.motivo)}
                    {ref ? ' · ' + ref : ''}
                  </td>
                  <td>{x.usuario}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : (
        <p className="sub">Sin movimientos para ese filtro.</p>
      )}
    </>
  )
}
