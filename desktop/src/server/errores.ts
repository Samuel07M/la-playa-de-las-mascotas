import type { z } from 'zod'
import { erroresPorCampo } from '../shared/esquemas'

/** Error de negocio o validación. Se responde como { error: { campo?, mensaje, ...extra } }. */
export class ErrorApi extends Error {
  constructor(
    public status: number,
    mensaje: string,
    public campo?: string,
    public extra?: Record<string, unknown>
  ) {
    super(mensaje)
  }
}

/** Valida con Zod; si falla, lanza ErrorApi 400 con el primer campo y su mensaje. */
export function validar<T>(schema: z.ZodType<T>, datos: unknown): T {
  const r = schema.safeParse(datos ?? {})
  if (!r.success) {
    const [campo, mensaje] = Object.entries(erroresPorCampo(r.error))[0]
    throw new ErrorApi(400, mensaje, campo || undefined)
  }
  return r.data
}

export const noExiste = (mensaje: string) => new ErrorApi(404, mensaje)
