import { useState } from 'react'
import logo from './assets/logo.webp'
import { IC } from './iconos'
import type { FilaInventario, Mensaje } from '@shared/tipos'
import { UiProvider } from './components/ui'
import { usarDatos } from './usarDatos'
import Catalogo from './views/Catalogo'
import NuevaVenta from './views/NuevaVenta'
import Entradas from './views/Entradas'
import Bajas from './views/Bajas'
import Inventario from './views/Inventario'
import Proveedores from './views/Proveedores'
import Cuadre from './views/Cuadre'
import Reportes from './views/Reportes'
import Mensajes from './views/Mensajes'

type Vista = 'cat' | 'sale' | 'ent' | 'baj' | 'inv' | 'prov' | 'caja' | 'rep' | 'msg'

// Menú del mockup (constante N de render()) + pantallas de la Fase 3 (PLAN §7), en el orden del plan.
const N: [Vista, string][] = [
  ['cat', 'Catálogo'],
  ['sale', 'Nueva venta'],
  ['ent', 'Entradas'],
  ['baj', 'Bajas'],
  ['inv', 'Inventario'],
  ['prov', 'Proveedores'],
  ['caja', 'Cuadre de caja'],
  ['rep', 'Reportes'],
  ['msg', 'Mensajes']
]

const VISTAS: Record<Vista, () => React.JSX.Element> = {
  cat: Catalogo,
  sale: NuevaVenta,
  ent: Entradas,
  baj: Bajas,
  inv: Inventario,
  prov: Proveedores,
  caja: Cuadre,
  rep: Reportes,
  msg: Mensajes
}

export default function App() {
  return (
    <UiProvider>
      <Armazon />
    </UiProvider>
  )
}

function Armazon() {
  const [view, setView] = useState<Vista>('cat')
  const Vista = VISTAS[view]
  // Contador de productos bajo el mínimo en el menú (HU-06).
  const L = (usarDatos<FilaInventario[]>('/inventario') ?? []).filter((r) => r.bajoMinimo).length
  // Contador de mensajes no entendidos pendientes (HU-15), con el mismo formato.
  const P = (usarDatos<Mensaje[]>('/mensajes?pendientes=1') ?? []).length
  const tag: Partial<Record<Vista, number>> = { inv: L, msg: P }
  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <img src={logo} alt="Logo" />
          <span>
            La Playa
            <br />
            de las Mascotas
          </span>
        </div>
        <div className="nl">Menú</div>
        <nav id="nav" className="nvb">
          {N.map(([k, t]) => (
            <button key={k} className={`nv ${view === k ? 'on' : ''}`} onClick={() => setView(k)}>
              <span className="ic" dangerouslySetInnerHTML={{ __html: IC[k] }} />
              <span className="tx">
                <span>{t}</span>
                {tag[k] ? <span className="tag rd">{tag[k]}</span> : null}
              </span>
            </button>
          ))}
        </nav>
        <div className="sf">
          <b>Isabel Torres</b>Administradora
        </div>
      </aside>
      <main className="main" id="main">
        <Vista key={view} />
      </main>
    </div>
  )
}
