// HU-07 — Proveedores e historial de precios. Sin mockup: solo componentes y clases del mockup.
import { useState } from 'react'
import { erroresPorCampo, numeroDe, precioProveedorSchema, proveedorSchema } from '@shared/esquemas'
import { fdia, hoyColombia, money } from '@shared/formato'
import type { PrecioProveedor, Producto, Proveedor } from '@shared/tipos'
import { api, ErrorDeApi } from '../api'
import { Encabezado, Er, useUi } from '../components/ui'
import { useMemoria } from '../memoria'
import { usarDatos } from '../usarDatos'

export default function Proveedores() {
  const { modal, toast, huboCambios } = useUi()
  const lista = usarDatos<Proveedor[]>('/proveedores')
  const productos = usarDatos<Producto[]>('/productos')
  const [pid, setPid] = useMemoria('prov.producto', '')

  async function tog(p: Proveedor) {
    try {
      await api.patch(`/proveedores/${p.id}/activo`, { activo: !p.activo })
      toast(!p.activo ? 'Proveedor activado' : 'Proveedor desactivado. Su historial de precios se conserva.')
      huboCambios()
    } catch (e) {
      toast((e as Error).message, true)
    }
  }

  return (
    <>
      <Encabezado titulo="Proveedores" sub="Registra proveedores y el historial de precios de compra." />
      <div className="bar">
        <span style={{ flex: 1 }} />
        <button className="b pri" onClick={() => modal(<ProveedorForm />)}>
          + Nuevo proveedor
        </button>
      </div>
      <div className="card wrap">
        {lista === null ? null : lista.length ? (
          <table className="tb">
            <tbody>
              <tr>
                <th>Proveedor</th>
                <th>Teléfono</th>
                <th>Correo</th>
                <th>Precios</th>
                <th>Estado</th>
                <th></th>
              </tr>
              {lista.map((p) => (
                <tr key={p.id} className={p.activo ? '' : 'off'}>
                  <td>
                    <b>{p.nombre}</b>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{p.telefono ?? '—'}</td>
                  <td>{p.correo ?? '—'}</td>
                  <td>{p.precios}</td>
                  <td>
                    <span className={`tag ${p.activo ? 'ok' : 'mu'}`}>{p.activo ? 'Activo' : 'Inactivo'}</span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="b" onClick={() => modal(<ProveedorForm proveedor={p} />)}>
                      Editar
                    </button>{' '}
                    <button className="b" disabled={!p.activo} onClick={() => modal(<PrecioForm proveedor={p} />)}>
                      Registrar precio
                    </button>{' '}
                    <button className="b" onClick={() => tog(p)}>
                      {p.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="sub">Aún no hay proveedores registrados.</p>
        )}
      </div>
      <div className="card">
        <b>Evolución del precio de compra</b>
        <div className="bar" style={{ margin: '10px 0' }}>
          <select className="in" value={pid} onChange={(e) => setPid(e.target.value)}>
            <option value="">Seleccionar producto…</option>
            {(productos ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        {pid ? <Evolucion key={pid} productoId={pid} /> : <p className="sub">Elige un producto para comparar sus precios por proveedor.</p>}
      </div>
    </>
  )
}

/** Historial del producto agrupado por proveedor, con la variación frente al precio anterior. */
function Evolucion({ productoId }: { productoId: string }) {
  const r = usarDatos<PrecioProveedor[]>(`/productos/${productoId}/precios`)
  if (r === null) return null
  if (!r.length) return <p className="sub">Este producto aún no tiene precios registrados.</p>
  // Último precio de cada proveedor → el menor es el mejor precio actual.
  const ultimo = new Map<number, PrecioProveedor>()
  for (const x of r) ultimo.set(x.proveedorId, x)
  const mejor = Math.min(...[...ultimo.values()].map((x) => x.precio))
  return (
    <div className="wrap">
      <table className="tb">
        <tbody>
          <tr>
            <th>Proveedor</th>
            <th>Fecha</th>
            <th>Precio de compra</th>
            <th>Variación</th>
            <th></th>
          </tr>
          {r.map((x, i) => {
            const prev = i > 0 && r[i - 1].proveedorId === x.proveedorId ? r[i - 1] : null
            const v = prev ? x.precio - prev.precio : 0
            const actual = ultimo.get(x.proveedorId)!.id === x.id
            return (
              <tr key={x.id}>
                <td>{prev ? '' : <b>{x.proveedor}</b>}</td>
                <td>{fdia(x.fecha)}</td>
                <td>
                  <b>{money(x.precio)}</b>
                </td>
                <td>
                  {!prev ? (
                    '—'
                  ) : v === 0 ? (
                    <span className="tag mu">Sin cambio</span>
                  ) : (
                    <span className={`tag ${v > 0 ? 'rd' : 'ok'}`}>
                      {v > 0 ? '▲ +' : '▼ −'}
                      {money(Math.abs(v))} ({v > 0 ? '+' : '−'}
                      {Math.abs((v / prev.precio) * 100).toFixed(1).replace('.', ',')} %)
                    </span>
                  )}
                </td>
                <td>{actual && x.precio === mejor && ultimo.size > 1 ? <span className="tag bl">Mejor precio actual</span> : null}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

type ErroresProv = Partial<Record<'nombre' | 'telefono' | 'correo', string>>

function ProveedorForm({ proveedor }: { proveedor?: Proveedor }) {
  const { cerrarModal, toast, huboCambios } = useUi()
  const [v, setV] = useState({
    nombre: proveedor?.nombre ?? '',
    telefono: proveedor?.telefono ?? '',
    correo: proveedor?.correo ?? ''
  })
  const [e, setE] = useState<ErroresProv>({})
  const cambiar = (k: keyof typeof v) => (ev: { target: { value: string } }) => setV({ ...v, [k]: ev.target.value })

  async function guardar() {
    const r = proveedorSchema.safeParse(v)
    if (!r.success) return setE(erroresPorCampo(r.error) as ErroresProv)
    try {
      if (proveedor) await api.put(`/proveedores/${proveedor.id}`, r.data)
      else await api.post('/proveedores', r.data)
    } catch (ex) {
      const x = ex as ErrorDeApi
      if (x.campo && x.campo in v) return setE({ [x.campo]: x.message })
      return toast(x.message, true)
    }
    cerrarModal()
    toast(proveedor ? 'Proveedor actualizado' : 'Proveedor creado')
    huboCambios()
  }

  const fld = (l: string, k: keyof typeof v, t: string) => (
    <label>
      {l}
      <input type={t} className={`in ${e[k] ? 'bad' : ''}`} value={v[k]} onChange={cambiar(k)} />
      <Er m={e[k]} />
    </label>
  )

  return (
    <>
      <h3>{proveedor ? 'Editar proveedor' : 'Nuevo proveedor'}</h3>
      {fld('Nombre', 'nombre', 'text')}
      {fld('Teléfono (opcional)', 'telefono', 'tel')}
      {fld('Correo (opcional)', 'correo', 'email')}
      <div className="mf">
        <button className="b" onClick={cerrarModal}>
          Cancelar
        </button>
        <button className="b pri" onClick={guardar}>
          Guardar
        </button>
      </div>
    </>
  )
}

type ErroresPrecio = Partial<Record<'productoId' | 'precio' | 'fecha', string>>

function PrecioForm({ proveedor }: { proveedor: Proveedor }) {
  const { cerrarModal, toast, huboCambios } = useUi()
  const activos = usarDatos<Producto[]>('/productos?activos=1')
  const [v, setV] = useState({ productoId: '', precio: '', fecha: hoyColombia() })
  const [e, setE] = useState<ErroresPrecio>({})
  const cambiar = (k: keyof typeof v) => (ev: { target: { value: string } }) => setV({ ...v, [k]: ev.target.value })

  async function guardar() {
    const r = precioProveedorSchema.safeParse({
      productoId: v.productoId ? Number(v.productoId) : undefined,
      precio: numeroDe(v.precio),
      fecha: v.fecha
    })
    if (!r.success) return setE(erroresPorCampo(r.error) as ErroresPrecio)
    try {
      await api.post(`/proveedores/${proveedor.id}/precios`, r.data)
    } catch (ex) {
      const x = ex as ErrorDeApi
      if (x.campo && x.campo in v) return setE({ [x.campo]: x.message })
      return toast(x.message, true)
    }
    cerrarModal()
    toast('Precio registrado')
    huboCambios()
  }

  return (
    <>
      <h3>Registrar precio · {proveedor.nombre}</h3>
      <label>
        Producto
        <select className={`in ${e.productoId ? 'bad' : ''}`} value={v.productoId} onChange={cambiar('productoId')}>
          <option value="">Seleccionar…</option>
          {(activos ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <Er m={e.productoId} />
      </label>
      <div className="row2">
        <label style={{ margin: 0 }}>
          Precio de compra (COP)
          <input type="number" className={`in ${e.precio ? 'bad' : ''}`} value={v.precio} onChange={cambiar('precio')} />
          <Er m={e.precio} />
        </label>
        <label style={{ margin: 0 }}>
          Fecha
          <input type="date" className={`in ${e.fecha ? 'bad' : ''}`} value={v.fecha} onChange={cambiar('fecha')} />
          <Er m={e.fecha} />
        </label>
      </div>
      <div className="mf">
        <button className="b" onClick={cerrarModal}>
          Cancelar
        </button>
        <button className="b pri" onClick={guardar}>
          Guardar
        </button>
      </div>
    </>
  )
}
