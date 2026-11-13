import { useState } from 'react'
import logo from './assets/logo.webp'
import { IC } from './iconos'
import { UiProvider } from './components/ui'
import Catalogo from './views/Catalogo'
import NuevaVenta from './views/NuevaVenta'
import Entradas from './views/Entradas'
import Bajas from './views/Bajas'
import Inventario from './views/Inventario'

type Vista = 'cat' | 'sale' | 'ent' | 'baj' | 'inv'

// Menú del mockup (constante N de render()).
const N: [Vista, string][] = [
  ['cat', 'Catálogo'],
  ['sale', 'Nueva venta'],
  ['ent', 'Entradas'],
  ['baj', 'Bajas'],
  ['inv', 'Inventario']
]

const VISTAS: Record<Vista, () => React.JSX.Element> = {
  cat: Catalogo,
  sale: NuevaVenta,
  ent: Entradas,
  baj: Bajas,
  inv: Inventario
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
