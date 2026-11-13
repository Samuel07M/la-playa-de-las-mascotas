// Cliente HTTP de la API embebida. React habla con la API por HTTP (igual que lo hará el chat).
import { API_URL } from '@shared/config'
import type { ErrorRespuesta } from '@shared/tipos'

const BASE = window.playa?.apiUrl ?? API_URL

export class ErrorDeApi extends Error {
  constructor(
    public status: number,
    mensaje: string,
    public campo?: string,
    public productos?: string[]
  ) {
    super(mensaje)
  }
}

async function pedir<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  let r: Response
  try {
    r = await fetch(BASE + ruta, {
      method: metodo,
      headers: cuerpo === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
    })
  } catch {
    throw new ErrorDeApi(0, 'No se pudo conectar con la base de datos de la aplicación.')
  }
  if (r.status === 204) return undefined as T
  const datos = await r.json().catch(() => ({}))
  if (!r.ok) {
    const e = (datos as ErrorRespuesta).error ?? { mensaje: 'Ocurrió un error inesperado.' }
    throw new ErrorDeApi(r.status, e.mensaje, e.campo, e.productos)
  }
  return datos as T
}

/** Arma un query string ignorando los valores vacíos. */
export function qs(p: Record<string, string | number | boolean | undefined | null>): string {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null && v !== '') u.set(k, String(v))
  const s = u.toString()
  return s ? '?' + s : ''
}

export const api = {
  get: <T>(ruta: string) => pedir<T>('GET', ruta),
  post: <T>(ruta: string, cuerpo: unknown = {}) => pedir<T>('POST', ruta, cuerpo),
  put: <T>(ruta: string, cuerpo: unknown) => pedir<T>('PUT', ruta, cuerpo),
  patch: <T>(ruta: string, cuerpo: unknown) => pedir<T>('PATCH', ruta, cuerpo),
  del: <T>(ruta: string) => pedir<T>('DELETE', ruta)
}
