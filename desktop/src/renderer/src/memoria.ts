// Estado de pantalla que sobrevive al cambiar de vista, como las variables globales del mockup
// (búsqueda, carrito, método de pago, cronómetro, formularios de entrada y baja, filtros).
import { useCallback, useState } from 'react'

const memoria = new Map<string, unknown>()

export function useMemoria<T>(clave: string, inicial: T | (() => T)) {
  const [valor, setValor] = useState<T>(() => {
    if (memoria.has(clave)) return memoria.get(clave) as T
    const v = typeof inicial === 'function' ? (inicial as () => T)() : inicial
    memoria.set(clave, v)
    return v
  })
  const set = useCallback(
    (nuevo: T | ((previo: T) => T)) => {
      const previo = memoria.get(clave) as T
      const v = typeof nuevo === 'function' ? (nuevo as (p: T) => T)(previo) : nuevo
      memoria.set(clave, v)
      setValor(v)
    },
    [clave]
  )
  return [valor, set] as const
}
