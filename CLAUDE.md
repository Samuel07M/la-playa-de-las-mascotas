# CLAUDE.md — La Playa de las Mascotas (app de escritorio)

Lee este archivo completo antes de cada tarea. Estas reglas están por encima de cualquier idea propia.

## Contexto
- Sistema de inventario y ventas para una tienda de mascotas de 3 personas. Contexto completo en `README.md`.
- Este repositorio construye **la app de escritorio de la administradora (Isabel)**, con la API y la base de datos embebidas.
- El plan de trabajo está en `docs/PLAN.md`. Sigue la fase y la historia de usuario (HU) que se te indique; no adelantes otras.

## Fuentes de verdad (en este orden)
1. Criterios de aceptación de la HU (issue de GitHub: `gh issue view <n>`, o el texto que te pegue el usuario).
2. Mockup aprobado: `docs/mockup/mockup-aprobado.html`. **Se sigue al pie de la letra**: mismas pantallas, menú, clases CSS, colores, textos, mensajes de error, toasts, confirmaciones y orden de los elementos.
3. `README.md` (reglas de negocio, sección 6; convenciones, sección 8).

Si dos fuentes se contradicen, o algo no está definido: **detente y pregunta**. No inventes funcionalidades, campos, pantallas, textos ni validaciones. Anota la duda en `docs/PREGUNTAS.md`.

## Stack (no cambiar sin autorización)
- Electron + electron-vite + React + TypeScript (carpeta `desktop/`).
- API: Fastify + Zod, en `desktop/src/server/`, arrancada por el proceso main en `127.0.0.1:3210`.
- Base de datos: SQLite con `better-sqlite3`, SQL plano (sin ORM). Esquema en `desktop/src/server/db/schema.sql`.
- Pruebas: Vitest. Empaquetado: electron-builder (instalador NSIS para Windows).
- No agregues dependencias nuevas sin preguntar.

## Reglas de negocio que nunca se rompen
- Stock = entradas − ventas − bajas. El stock **se calcula** desde `movimientos`; no existe una columna de stock.
- Los movimientos **nunca se borran ni se editan**. Productos y proveedores se desactivan, no se eliminan.
- Venta que supera el stock: se advierte y se exige confirmación (no se bloquea). Baja que supera el stock: se rechaza.
- Baja requiere motivo (`vencido`, `dañado`, `otro`). Entrada requiere referencia. Cantidades: enteros > 0. Precio > 0.
- Alias únicos sin distinguir mayúsculas/minúsculas.
- **Toda validación se hace en la API** (Zod), además de la interfaz.

## Convenciones
- Interfaz y mensajes en español, copiados literalmente del mockup.
- Moneda COP sin decimales (`$62.000`). Zona horaria America/Bogota. Formato de fecha: el del mockup.
- Código en inglés o español, pero consistente dentro de cada archivo; tablas y columnas de la BD en español.
- Cada regla de negocio nueva lleva su prueba en Vitest.

## Git
- **Nunca hagas `git push`, ni crees PRs, ni hagas merge.** Solo el usuario sube cambios.
- Todo se trabaja en la rama `main`. **No crees ni cambies de rama.**
- Puedes hacer commits locales en `main`, uno o varios por HU, con mensajes tipo `feat(hu-01): ...`, `test(hu-03): ...`. El último commit de cada HU termina con `Closes #<n>`.
- No hagas commit si `npm run typecheck` o `npm test` fallan.

## Antes de dar una tarea por terminada
1. `npm run typecheck` y `npm test` sin errores.
2. Recorre cada criterio de aceptación de la HU y di cómo se cumple (archivo + prueba o pasos manuales).
3. Indica qué debe revisar el usuario en `npm run dev`.
