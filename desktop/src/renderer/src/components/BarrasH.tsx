// Gráfica de barras horizontales de una sola serie (Reportes, HU-09). Sin dependencias:
// barras de 14 px con extremo redondeado de 4 px, valor al final de cada barra y tooltip
// al pasar el mouse o con el teclado. La tabla del reporte queda como vista de datos.
import { useRef, useState } from 'react'

export interface FilaBarra {
  id: number
  etiqueta: string
  valor: number
  /** Texto del tooltip (todas las medidas de la fila). */
  detalle: string
}

export function BarrasH({
  titulo,
  filas,
  formato
}: {
  titulo: string
  filas: FilaBarra[]
  formato: (n: number) => string
}) {
  const caja = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ f: FilaBarra; x: number; y: number } | null>(null)
  const max = Math.max(...filas.map((f) => f.valor), 1)

  function mostrar(f: FilaBarra, el: HTMLElement, x?: number) {
    const c = caja.current!.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    setTip({
      f,
      x: Math.min((x ?? r.left + r.width / 2) - c.left + 12, c.width - 180),
      y: r.bottom - c.top + 4
    })
  }

  return (
    <div className="ch" ref={caja} onMouseLeave={() => setTip(null)}>
      <h4>{titulo}</h4>
      <div role="list" aria-label={titulo}>
        {filas.map((f) => (
          <div
            key={f.id}
            role="listitem"
            tabIndex={0}
            className="chr"
            aria-label={`${f.etiqueta}: ${f.detalle}`}
            onMouseMove={(e) => mostrar(f, e.currentTarget, e.clientX)}
            onFocus={(e) => mostrar(f, e.currentTarget)}
            onBlur={() => setTip(null)}
          >
            <span className="chl">{f.etiqueta}</span>
            <span className="cht">
              <span className="chb" style={{ width: `calc((100% - 76px) * ${f.valor / max})` }} />
              <span className="chv">{formato(f.valor)}</span>
            </span>
          </div>
        ))}
      </div>
      {tip ? (
        <div className="chtip" style={{ left: Math.max(tip.x, 0), top: tip.y }}>
          <b>{tip.f.etiqueta}</b>
          <br />
          {tip.f.detalle}
        </div>
      ) : null}
    </div>
  )
}
