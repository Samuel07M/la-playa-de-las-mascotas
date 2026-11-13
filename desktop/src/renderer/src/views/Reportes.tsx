// HU-09 — Reportes de rotación, top productos y proveedores. Sin mockup: solo clases del mockup.
import { ROTACIONES, TOP_PRODUCTOS, TOP_PROVEEDORES, type Rotacion } from '@shared/constantes'
import { rangoSchema } from '@shared/esquemas'
import { capitalizar, hoyColombia, money, sumarDias } from '@shared/formato'
import type { FilaRotacion, TopProducto, TopProveedor } from '@shared/tipos'
import { qs } from '../api'
import { Encabezado } from '../components/ui'
import { BarrasH } from '../components/BarrasH'
import { useMemoria } from '../memoria'
import { usarDatos } from '../usarDatos'

const T: Record<Rotacion, string> = { alta: 'ok', media: 'bl', baja: 'mu' }

/** Mensaje claro cuando el periodo no tiene datos (HU-09 C4). */
const SinDatos = ({ m }: { m: string }) => <div className="alert bl">{m}</div>

export default function Reportes() {
  const [f, setF] = useMemoria('rep.rango', () => ({
    desde: sumarDias(hoyColombia(), -29),
    hasta: hoyColombia()
  }))
  const valido = rangoSchema.safeParse(f)
  const q = valido.success ? qs(f) : null
  return (
    <>
      <Encabezado titulo="Reportes" sub="Rotación, productos más vendidos y principales proveedores." />
      <div className="bar">
        <label style={{ margin: 0, flex: 1 }}>
          Desde
          <input
            className="in"
            style={{ width: '100%' }}
            type="date"
            value={f.desde}
            onChange={(e) => setF({ ...f, desde: e.target.value })}
          />
        </label>
        <label style={{ margin: 0, flex: 1 }}>
          Hasta
          <input
            className="in"
            style={{ width: '100%' }}
            type="date"
            value={f.hasta}
            onChange={(e) => setF({ ...f, hasta: e.target.value })}
          />
        </label>
      </div>
      {valido.success ? (
        <>
          <RotacionCard q={q!} />
          <TopProductosCard q={q!} />
          <ProveedoresCard q={q!} />
        </>
      ) : (
        <div className="alert rd">{valido.error.issues[0].message}</div>
      )}
    </>
  )
}

function RotacionCard({ q }: { q: string }) {
  const r = usarDatos<FilaRotacion[]>('/reportes/rotacion' + q)
  return (
    <div className="card wrap">
      <b>Rotación de productos</b>
      <small style={{ color: 'var(--mu)', display: 'block', marginBottom: 8 }}>
        Los productos activos se dividen en tres grupos iguales según las unidades vendidas en el periodo.
      </small>
      {r === null ? null : r.length ? (
        <>
          <div style={{ marginBottom: 6 }}>
            {ROTACIONES.map((k) => (
              <span key={k} className={`tag ${T[k]}`} style={{ marginRight: 6 }}>
                {capitalizar(k)}: {r.filter((x) => x.rotacion === k).length}
              </span>
            ))}
          </div>
          <table className="tb">
            <tbody>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Vendidas</th>
                <th>Stock</th>
                <th>Rotación</th>
              </tr>
              {r.map((x) => (
                <tr key={x.id}>
                  <td>
                    <b>{x.nombre}</b>
                  </td>
                  <td>{x.categoria}</td>
                  <td>{x.vendidas}</td>
                  <td>{x.stock}</td>
                  <td>
                    <span className={`tag ${T[x.rotacion]}`}>{capitalizar(x.rotacion)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <SinDatos m="No hay ventas en el periodo seleccionado. Elige otro rango de fechas." />
      )}
    </div>
  )
}

/** Fila de la gráfica: el tooltip muestra las dos medidas del producto. */
const fila = (x: TopProducto, valor: number) => ({
  id: x.id,
  etiqueta: x.nombre,
  valor,
  detalle: `${x.cantidad} unidad${x.cantidad === 1 ? '' : 'es'} · ${money(x.valor)}`
})

function TopProductosCard({ q }: { q: string }) {
  const r = usarDatos<TopProducto[]>('/reportes/top-productos' + q)
  return (
    <div className="card wrap">
      <b>Top {TOP_PRODUCTOS} productos más vendidos</b>
      {r === null ? null : r.length ? (
        <>
          <div className="row2" style={{ gap: 24 }}>
            <BarrasH titulo="Unidades vendidas" filas={r.map((x) => fila(x, x.cantidad))} formato={(n) => String(n)} />
            <BarrasH
              titulo="Valor vendido"
              filas={[...r].sort((a, b) => b.valor - a.valor).map((x) => fila(x, x.valor))}
              formato={money}
            />
          </div>
          <table className="tb">
            <tbody>
              <tr>
                <th>#</th>
                <th>Producto</th>
                <th>Unidades</th>
                <th>Valor vendido</th>
              </tr>
              {r.map((x, i) => (
                <tr key={x.id}>
                  <td>{i + 1}</td>
                  <td>
                    <b>{x.nombre}</b>
                  </td>
                  <td>{x.cantidad}</td>
                  <td>{money(x.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <SinDatos m="No hay ventas en el periodo seleccionado." />
      )}
    </div>
  )
}

function ProveedoresCard({ q }: { q: string }) {
  const r = usarDatos<TopProveedor[]>('/reportes/proveedores' + q)
  return (
    <div className="card wrap">
      <b>Top {TOP_PROVEEDORES} proveedores</b>
      <small style={{ color: 'var(--mu)', display: 'block' }}>
        Por valor comprado: entradas con proveedor × su precio de compra vigente
      </small>
      {r === null ? null : r.length ? (
        <table className="tb">
          <tbody>
            <tr>
              <th>#</th>
              <th>Proveedor</th>
              <th>Entradas</th>
              <th>Unidades</th>
              <th>Valor comprado</th>
            </tr>
            {r.map((x, i) => (
              <tr key={x.id}>
                <td>{i + 1}</td>
                <td>
                  <b>{x.nombre}</b>
                </td>
                <td>{x.entradas}</td>
                <td>{x.unidades}</td>
                <td>{money(x.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <SinDatos m="No hay compras a proveedores en el periodo. Registra el proveedor al hacer cada entrada." />
      )}
    </div>
  )
}
