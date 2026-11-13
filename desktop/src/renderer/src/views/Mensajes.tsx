// HU-15 — Revisar mensajes no entendidos. Sin mockup: solo componentes y clases del mockup.
import { useState } from 'react'
import { aliasDesdeMensajeSchema, erroresPorCampo } from '@shared/esquemas'
import { fd } from '@shared/formato'
import type { Mensaje, Producto } from '@shared/tipos'
import { api, ErrorDeApi } from '../api'
import { Encabezado, Er, useUi } from '../components/ui'
import { usarDatos } from '../usarDatos'

export default function Mensajes() {
  const { modal, toast, huboCambios } = useUi()
  const lista = usarDatos<Mensaje[]>('/mensajes?pendientes=1')

  async function revisado(m: Mensaje) {
    try {
      await api.patch(`/mensajes/${m.id}/revisado`, {})
      toast('Mensaje marcado como revisado')
      huboCambios()
    } catch (e) {
      toast((e as Error).message, true)
    }
  }

  return (
    <>
      <Encabezado
        titulo="Mensajes no entendidos"
        sub="Mensajes del chat que el sistema no reconoció. Conviértelos en alias para que los entienda la próxima vez."
      />
      {lista === null ? null : lista.length ? (
        <div className="card wrap">
          <table className="tb">
            <tbody>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Mensaje</th>
                <th></th>
              </tr>
              {lista.map((m) => (
                <tr key={m.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fd(m.fecha)}</td>
                  <td>{m.usuario}</td>
                  <td>
                    <b>«{m.texto}»</b>
                    {m.aliasTexto ? (
                      <span className="er" style={{ color: 'var(--gn)' }}>
                        ✓ alias «{m.aliasTexto}» de {m.producto}
                      </span>
                    ) : null}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="b" onClick={() => modal(<AliasForm mensaje={m} />)}>
                      Crear alias
                    </button>{' '}
                    <button className="b pri" onClick={() => revisado(m)}>
                      Marcar revisado
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="alert ok">✓ No hay mensajes pendientes de revisión.</div>
      )}
    </>
  )
}

type Errores = Partial<Record<'productoId' | 'texto', string>>

function AliasForm({ mensaje }: { mensaje: Mensaje }) {
  const { cerrarModal, toast, huboCambios } = useUi()
  const activos = usarDatos<Producto[]>('/productos?activos=1')
  const [v, setV] = useState({ productoId: '', texto: mensaje.texto })
  const [e, setE] = useState<Errores>({})

  async function guardar() {
    const r = aliasDesdeMensajeSchema.safeParse({
      productoId: v.productoId ? Number(v.productoId) : undefined,
      texto: v.texto
    })
    if (!r.success) return setE(erroresPorCampo(r.error) as Errores)
    try {
      await api.post(`/mensajes/${mensaje.id}/alias`, r.data)
    } catch (ex) {
      const x = ex as ErrorDeApi
      if (x.campo === 'productoId' || x.campo === 'texto') return setE({ [x.campo]: x.message })
      return toast(x.message, true)
    }
    cerrarModal()
    toast('Alias agregado')
    huboCambios()
  }

  return (
    <>
      <h3>Crear alias desde el mensaje</h3>
      <p className="sub">
        {mensaje.usuario} escribió: «{mensaje.texto}». Deja solo el nombre con el que llama al producto.
      </p>
      <label>
        Producto
        <select
          className={`in ${e.productoId ? 'bad' : ''}`}
          value={v.productoId}
          onChange={(ev) => setV({ ...v, productoId: ev.target.value })}
        >
          <option value="">Seleccionar…</option>
          {(activos ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <Er m={e.productoId} />
      </label>
      <label>
        Alias
        <input
          className={`in ${e.texto ? 'bad' : ''}`}
          value={v.texto}
          onChange={(ev) => setV({ ...v, texto: ev.target.value })}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter') guardar()
          }}
        />
        <Er m={e.texto} />
      </label>
      <div className="mf">
        <button className="b" onClick={cerrarModal}>
          Cancelar
        </button>
        <button className="b pri" onClick={guardar}>
          Guardar alias
        </button>
      </div>
    </>
  )
}
