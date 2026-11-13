# Preguntas abiertas

Dudas que Claude Code encontró durante el desarrollo. Se resuelven con el equipo o con Isabel antes de seguir.
Las preguntas 1 a 8 de `docs/PLAN.md` (sección 9) siguen vigentes; aquí se agregan las nuevas.

| # | Fase / HU | Pregunta | Qué se hizo mientras tanto |
|---|---|---|---|
| 9 | Fase 0 | `better-sqlite3` 13 no publica binarios precompilados y este PC no tiene Visual Studio para compilarlo. ¿Se acepta quedarse en **Electron 42.11.18 + better-sqlite3 12.11.1** (la combinación más nueva con binario)? | Se usa esa combinación. El plan no fijaba versión. |
| 10 | Fase 0 | npm 11 bloquea los scripts de instalación. Se denegaron los de `better-sqlite3` (compilaría para Node y fallaría sin Visual Studio) y `electron-winstaller` (no se usa con NSIS), en `allowScripts` de `package.json`. El binario correcto lo pone `electron-builder install-app-deps` (postinstall). | Nada pendiente; es para que el equipo lo sepa. |
| 11 | Fase 0 | El logo del mockup mide 96×96 px; el icono `.ico` (256×256) se ve algo borroso. ¿Hay un logo en mejor resolución? | Se generó `resources/icon.ico` escalando el del mockup. |
| 12 | HU-01 | El mockup acepta precios con decimales (ej. 62000.5). La BD guarda enteros (COP sin decimales). | La API rechaza decimales con el mismo texto «El precio debe ser mayor que 0.». ¿Se deja así o se pide otro texto? |
| 13 | HU-03/06 | Una venta confirmada sobre el stock deja el stock en negativo (ej. −1). Después no se pueden registrar bajas de ese producto hasta registrar una entrada. El mockup se comporta igual. ¿Correcto? | Se dejó igual que el mockup. |
| 14 | HU-04 | Si Isabel escribe la referencia `INV-INICIAL`, esa entrada no aparece en «Últimas entradas» (igual que en el mockup). ¿Es así como se cargará el inventario inicial real (pregunta 6 del plan)? | Se permite esa referencia. |
| 15 | Todas | Formato de fecha (pregunta 2 del plan): el mismo código del mockup muestra en Electron «12 de nov, 10:09 p. m.», no «12 nov., 14:30». | Se usa exactamente la función `fd()` del mockup, en hora de Colombia. |
| 16 | Todas | Textos que el mockup no define y que solo aparecen en casos raros: «El producto no existe.», «El alias no existe.», «Solicitud inválida.», «Ocurrió un error inesperado.», «No se pudo conectar con la base de datos de la aplicación.». ¿Se aprueban? | Se usan esos textos. |
| 17 | Fase 1 | El esquema v1 solo tiene las tablas de HU-01 a HU-06. `proveedores`, `precios_proveedor`, `cuadres_caja` y `mensajes` se agregan como migración v2 cuando se resuelvan las preguntas 3, 4 y 5. | Nada pendiente; las migraciones están versionadas con `PRAGMA user_version`. |
