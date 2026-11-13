// HU-01 · HU-02 — Catálogo de productos (vCat, catList, pForm, pSave, tog del mockup).
import { useState } from 'react'
import { CATEGORIAS } from '@shared/constantes'
import { erroresPorCampo, numeroDe, productoSchema } from '@shared/esquemas'
import { money } from '@shared/formato'
import type { Producto } from '@shared/tipos'
import { api, ErrorDeApi, qs } from '../api'
import { Encabezado, Er, useUi } from '../components/ui'
import { useMemoria } from '../memoria'
import { usarDatos } from '../usarDatos'

export default function Catalogo() {
  const { modal, toast, huboCambios } = useUi()
  const [q, setQ] = useMemoria('cat.q', '')
  const lista = usarDatos<Producto[]>('/productos' + qs({ q: q.trim() }))

  async function tog(p: Producto) {
    try {
      await api.patch(`/productos/${p.id}/activo`, { activo: !p.activo })
      toast(!p.activo ? 'Producto activado' : 'Producto desactivado. Su historial se conserva.')
      huboCambios()
    } catch (e) {
      toast((e as Error).message, true)
    }
  }

  return (
    <>
      <Encabezado titulo="Catálogo de productos" sub="Crea, edita y desactiva productos; asigna alias." />
      <div className="bar">
        <input
          className="in"
          placeholder="Buscar por nombre, categoría o alias…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="b pri" onClick={() => modal(<ProductoForm />)}>
          + Nuevo producto
        </button>
      </div>
      <div className="card wrap" id="cl">
        {lista === null ? null : lista.length ? (
          <table className="tb">
            <tbody>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Mín.</th>
                <th>Estado</th>
                <th></th>
              </tr>
              {lista.map((p) => (
                <tr key={p.id} className={p.activo ? '' : 'off'}>
                  <td>
                    <b>{p.nombre}</b>
                    {p.aliasCoincidente ? (
                      <span className="er" style={{ color: 'var(--pr)' }}>
                        ↳ coincide con el alias «{p.aliasCoincidente}»
                      </span>
                    ) : null}
                    <div>
                      {p.alias.map((a) => (
                        <span key={a.id} className="chip">
                          {a.texto}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>{p.categoria}</td>
                  <td>{money(p.precioVenta)}</td>
                  <td>{p.stock}</td>
                  <td>{p.stockMinimo}</td>
                  <td>
                    <span className={`tag ${p.activo ? 'ok' : 'mu'}`}>{p.activo ? 'Activo' : 'Inactivo'}</span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="b" onClick={() => modal(<ProductoForm producto={p} />)}>
                      Editar
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
          <p className="sub">Sin resultados.</p>
        )}
      </div>
    </>
  )
}

// Campos del formulario → campos de la API.
const CAMPO: Record<string, 'n' | 'c' | 'pr' | 'mn'> = {
  nombre: 'n',
  categoria: 'c',
  precioVenta: 'pr',
  stockMinimo: 'mn'
}
type Errores = Partial<Record<'n' | 'c' | 'pr' | 'mn', string>>

function ProductoForm({ producto }: { producto?: Producto }) {
  const { cerrarModal, toast, huboCambios } = useUi()
  const [v, setV] = useState({
    n: producto?.nombre ?? '',
    c: producto?.categoria ?? '',
    pr: producto ? String(producto.precioVenta) : '',
    mn: producto ? String(producto.stockMinimo) : ''
  })
  const [e, setE] = useState<Errores>({})
  const cambiar = (k: keyof typeof v) => (ev: { target: { value: string } }) =>
    setV({ ...v, [k]: ev.target.value })

  async function pSave() {
    const datos = {
      nombre: v.n.trim(),
      categoria: v.c.trim(),
      precioVenta: numeroDe(v.pr),
      stockMinimo: numeroDe(v.mn)
    }
    const r = productoSchema.safeParse(datos)
    if (!r.success) {
      const err: Errores = {}
      for (const [campo, m] of Object.entries(erroresPorCampo(r.error))) err[CAMPO[campo]] = m
      return setE(err)
    }
    try {
      if (producto) await api.put(`/productos/${producto.id}`, r.data)
      else await api.post('/productos', r.data)
    } catch (ex) {
      const x = ex as ErrorDeApi
      if (x.campo && CAMPO[x.campo]) return setE({ [CAMPO[x.campo]]: x.message })
      return toast(x.message, true)
    }
    cerrarModal()
    toast(producto ? 'Producto actualizado en todo el sistema' : 'Producto creado')
    huboCambios()
  }

  const fld = (l: string, k: 'n' | 'pr' | 'mn', t: string) => (
    <label>
      {l}
      <input id={`f_${k}`} type={t} className={`in ${e[k] ? 'bad' : ''}`} value={v[k]} onChange={cambiar(k)} />
      <Er m={e[k]} />
    </label>
  )

  return (
    <>
      <h3>{producto ? 'Editar producto' : 'Nuevo producto'}</h3>
      {fld('Nombre', 'n', 'text')}
      <label>
        Categoría
        <select id="f_c" className={`in ${e.c ? 'bad' : ''}`} value={v.c} onChange={cambiar('c')}>
          <option value="">Seleccionar…</option>
          {CATEGORIAS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <Er m={e.c} />
      </label>
      {fld('Precio de venta (COP)', 'pr', 'number')}
      {fld('Stock mínimo (unidades)', 'mn', 'number')}
      <div className="mf">
        <button className="b" onClick={cerrarModal}>
          Cancelar
        </button>
        <button className="b pri" onClick={pSave}>
          Guardar
        </button>
      </div>
    </>
  )
}
