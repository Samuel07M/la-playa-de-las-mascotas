import { useEffect, useState } from 'react'
import { api } from './api'
import { useUi } from './components/ui'

/**
 * Pide datos a la API y los vuelve a pedir cada vez que cambia la ruta o hay cambios
 * de datos en cualquier pantalla (useUi().version). Así todo se refleja sin recargar.
 */
export function usarDatos<T>(ruta: string | null): T | null {
  const { version, toast } = useUi()
  const [datos, setDatos] = useState<T | null>(null)
  useEffect(() => {
    if (ruta === null) return
    let vigente = true
    api
      .get<T>(ruta)
      .then((d) => vigente && setDatos(d))
      .catch((e: Error) => vigente && toast(e.message, true))
    return () => {
      vigente = false
    }
  }, [ruta, version, toast])
  return datos
}
