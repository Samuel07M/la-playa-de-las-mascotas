// Modal, Toast y ask(): mismo comportamiento que las funciones modal(), toast() y ask() del mockup.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

interface Ui {
  /** Toast verde (o rojo si error) que desaparece a los 2,8 s. */
  toast: (mensaje: string, error?: boolean) => void
  /** Abre un modal con el contenido dado. */
  modal: (contenido: ReactNode) => void
  cerrarModal: () => void
  /** Confirmación con «Cancelar» / «Confirmar». */
  ask: (mensaje: string, alConfirmar: () => void) => void
  /** Se incrementa con cada cambio de datos; las vistas vuelven a pedir los datos a la API. */
  version: number
  huboCambios: () => void
}

const Ctx = createContext<Ui | null>(null)

export const useUi = (): Ui => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useUi fuera de UiProvider')
  return c
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [contenido, setContenido] = useState<ReactNode>(null)
  const [aviso, setAviso] = useState<{ m: string; e: boolean; visible: boolean }>({ m: '', e: false, visible: false })
  const [version, setVersion] = useState(0)
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined)

  const toast = useCallback((m: string, e = false) => {
    setAviso({ m, e, visible: true })
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setAviso((a) => ({ ...a, visible: false })), 2800)
  }, [])
  useEffect(() => () => clearTimeout(temporizador.current), [])

  const cerrarModal = useCallback(() => setContenido(null), [])
  const modal = useCallback((c: ReactNode) => setContenido(c), [])
  const ask = useCallback(
    (m: string, alConfirmar: () => void) =>
      setContenido(
        <>
          <h3>Confirmación</h3>
          <p>{m}</p>
          <div className="mf">
            <button className="b" onClick={() => setContenido(null)}>
              Cancelar
            </button>
            <button
              className="b pri"
              onClick={() => {
                setContenido(null)
                alConfirmar()
              }}
            >
              Confirmar
            </button>
          </div>
        </>
      ),
    []
  )
  const huboCambios = useCallback(() => setVersion((v) => v + 1), [])

  return (
    <Ctx.Provider value={{ toast, modal, cerrarModal, ask, version, huboCambios }}>
      {children}
      <div id="modal">
        {contenido !== null && (
          <div
            className="ov"
            onClick={(e) => {
              if (e.target === e.currentTarget) cerrarModal()
            }}
          >
            <div className="md">{contenido}</div>
          </div>
        )}
      </div>
      <div id="toast" className={aviso.e ? 'e' : ''} style={{ display: aviso.visible ? 'block' : 'none' }}>
        {aviso.m}
      </div>
    </Ctx.Provider>
  )
}

/** Encabezado de cada pantalla: hd() del mockup. */
export function Encabezado({ titulo, sub }: { titulo: string; sub: string }) {
  return (
    <>
      <h1>{titulo}</h1>
      <p className="sub">{sub}</p>
    </>
  )
}

/** Mensaje de error bajo un campo: er() del mockup. */
export function Er({ m }: { m?: string }) {
  return m ? <small className="er">{m}</small> : null
}
