# Plan de desarrollo — App de escritorio de La Playa de las Mascotas

Plan para construir con **Claude Code** la parte funcional de la app de escritorio de Isabel (HU-01 a HU-09 y HU-15), instalarla en el PC de la tienda y recoger las evidencias de las Secciones 4 y 5 de la Entrega 3.

**Reglas del plan**
- Todo se trabaja en `main`, sin ramas.
- Solo Samuel hace `push`. Claude Code trabaja y hace commits en local; nunca sube nada (bloqueado en `.claude/settings.json`).
- El mockup aprobado (`docs/mockup/mockup-aprobado.html`) se sigue al pie de la letra.
- No se agrega nada que no esté en el backlog, el mockup o el README. Las dudas van a `docs/PREGUNTAS.md`.

---

## 1. Arquitectura y por qué

```
PC de la tienda (Windows)
┌──────────────────────────────────────────────────────────────┐
│  La Playa de las Mascotas.exe  (Electron)                     │
│                                                              │
│  ┌──────────────── proceso main (Node.js) ────────────────┐  │
│  │  1. Abre la base de datos SQLite (playa.db)            │  │
│  │  2. Arranca la API Fastify en 127.0.0.1:3210           │  │
│  │  3. Abre la ventana                                     │  │
│  └────────────────────────────────────────────────────────┘  │
│                 ▲ HTTP/JSON                                    │
│  ┌──────────────┴─── proceso renderer (ventana) ──────────┐  │
│  │  React: Catálogo · Nueva venta · Entradas · Bajas ·     │  │
│  │  Inventario · Proveedores · Cuadre · Reportes · Mensajes│  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
        (después) celulares en el wifi de la tienda → misma API (chat)
```

| Pieza | Qué es | Qué hace aquí |
|---|---|---|
| **TypeScript** | El lenguaje | Todo el código está escrito en TypeScript. |
| **Electron** | Contenedor de escritorio | Convierte la app en un programa de Windows (.exe). Su proceso *main* corre Node.js: abre la BD y arranca la API. Su proceso *renderer* es la ventana. |
| **React** | Librería de interfaz | Dibuja las pantallas del mockup como componentes. |
| **Fastify + Zod** | Servidor HTTP + validador | La API: recibe peticiones, valida los datos, aplica las reglas de negocio y responde. |
| **SQLite (better-sqlite3)** | Base de datos en un archivo | Guarda todo en `playa.db`, dentro de la carpeta de datos de la app en Windows. |
| **Vitest** | Pruebas | Verifica las reglas de negocio automáticamente. |
| **electron-builder** | Empaquetador | Genera el instalador `.exe`. |

**Decisiones**
- **API embebida en la app.** Es un solo instalador y no hay que mantener servidores aparte (README, principio 7). Cuando se haga el chat, la API pasa a escuchar en la red local para que los celulares la alcancen. Hoy escucha solo en `127.0.0.1`, así que Windows no pide permisos de firewall.
- **React habla con la API por HTTP, aunque estén en el mismo programa.** El chat usará exactamente la misma API, así se mantiene "un backend, dos clientes" de la Entrega 2.
- **SQL plano, sin ORM.** Hay menos piezas que aprender y el equipo ya conoce SQL del curso de bases de datos. (Cambio frente a la propuesta anterior, que mencionaba Drizzle.)
- **Una sola instancia.** La app no se puede abrir dos veces, para que no haya dos APIs sobre la misma BD.
- **El stock no se guarda: se calcula.** Es la suma de movimientos (entradas − ventas − bajas). Así la invariante de HU-06 siempre se cumple.

---

## 2. Qué instalar (una vez, en tu PC)

| Herramienta | Para qué | Cómo |
|---|---|---|
| Node.js LTS | Correr y compilar el proyecto | nodejs.org → versión LTS |
| Git for Windows | Git y Git Bash (Claude Code lo usa como terminal) | git-scm.com |
| GitHub CLI (`gh`) | Que Claude Code lea los issues (HU) | `winget install GitHub.cli` → `gh auth login` |
| VS Code | Editor | code.visualstudio.com |
| Claude Code | Desarrollo asistido | PowerShell: `irm https://claude.ai/install.ps1 \| iex` → abre una terminal nueva → `claude` |

> Instala Git for Windows **antes** de Claude Code. Así Claude Code usa Git Bash, y las reglas de `.claude/settings.json` (como el bloqueo de `git push`) se aplican a los comandos de Bash.

---

## 3. Estructura final del repositorio

```
la-playa-de-las-mascotas/
├── README.md
├── CLAUDE.md                       ← reglas para Claude Code (se lee en cada sesión)
├── .claude/settings.json           ← permisos: bloquea push, PR y merge
├── .github/workflows/ci.yml        ← corre typecheck + pruebas en cada push a main
├── docs/
│   ├── PLAN.md                     ← este archivo
│   ├── PREGUNTAS.md                ← dudas abiertas para el equipo/Isabel
│   ├── mockup/mockup-aprobado.html ← mockup aprobado (referencia literal)
│   └── evidencias/                 ← capturas para el informe (Sección 4)
└── desktop/
    ├── package.json
    ├── electron.vite.config.ts
    ├── electron-builder.yml
    ├── resources/icon.ico          ← logo del mockup
    └── src/
        ├── main/index.ts           ← arranca BD + API + ventana
        ├── preload/index.ts        ← expone la URL de la API a la ventana
        ├── shared/                 ← tipos y textos compartidos (API ↔ React)
        ├── server/
        │   ├── app.ts              ← crea la app Fastify y registra rutas
        │   ├── db/schema.sql       ← tablas
        │   ├── db/connection.ts    ← abre playa.db y aplica el esquema
        │   ├── db/seed.ts          ← datos de ejemplo del mockup (solo demo)
        │   ├── modules/            ← un archivo de rutas + uno de lógica por dominio
        │   │   ├── productos.ts  alias.ts  ventas.ts  entradas.ts  bajas.ts
        │   │   ├── inventario.ts proveedores.ts cuadres.ts reportes.ts mensajes.ts
        │   └── __tests__/          ← pruebas Vitest
        └── renderer/
            ├── index.html
            └── src/
                ├── App.tsx         ← menú lateral + cambio de vista (como el mockup)
                ├── styles.css      ← CSS del mockup copiado tal cual
                ├── api.ts          ← cliente HTTP
                ├── components/     ← Modal, Toast, Confirmación, Campo, Tag…
                └── views/          ← Catalogo, NuevaVenta, Entradas, Bajas, Inventario…
```

---

## 4. Modelo de datos (sale de las HU y del mockup)

```sql
productos        (id, nombre, categoria, precio_venta INT >0, stock_minimo INT >=0, activo, creado_en)
alias            (id, producto_id → productos, texto, texto_normalizado UNIQUE)   -- en minúsculas
ventas           (id, consecutivo UNIQUE 'V-001', metodo_pago ∈ {efectivo,digital}, usuario, fecha)
movimientos      (id, producto_id, tipo ∈ {venta,entrada,baja}, cantidad INT >0,
                  motivo, referencia, detalle, venta_id → ventas NULL, precio_unitario NULL,
                  usuario, fecha)
proveedores      (id, nombre, contacto, activo)                                    -- HU-07
precios_proveedor(id, proveedor_id, producto_id, precio INT >0, fecha)             -- HU-07
cuadres_caja     (id, dia, total_efectivo, total_digital, efectivo_contado, diferencia,
                  usuario, creado_en)                                              -- HU-08
mensajes         (id, texto, usuario, fecha, estado ∈ {confirmado,corregido,no_entendido},
                  revisado)                                                         -- HU-14/15
```

- **Cómo se llena `movimientos`**, igual que en el mockup:
  - **venta:** `motivo` = método de pago, `referencia` = consecutivo (V-001).
  - **entrada:** `motivo` = "Recepción", `referencia` = factura o remisión.
  - **baja:** `motivo` = Vencido/Dañado/Otro, `detalle` = texto opcional.
- **`precio_unitario` en la venta:** el mockup no lo guarda, pero el cuadre de caja (HU-08) necesita el valor vendido ese día aunque el precio cambie después. No es una función nueva: es el dato que HU-08 necesita para funcionar.
- **Stock de un producto:** `SUM(CASE tipo WHEN 'entrada' THEN cantidad ELSE -cantidad END)`.
- **Inventario inicial:** igual que en el mockup, es una entrada con referencia `INV-INICIAL`, que no aparece en "Últimas entradas".

---

## 5. API (rutas por HU)

| HU | Método y ruta | Notas |
|---|---|---|
| 01 | `GET /productos?q=` · `POST /productos` · `PUT /productos/:id` · `PATCH /productos/:id/activo` | La búsqueda incluye alias e indica cuál alias coincidió |
| 02 | `POST /productos/:id/alias` · `DELETE /alias/:id` | 409 con «Ese alias ya pertenece a «X».» |
| 03 | `POST /ventas` | Si alguna línea supera el stock y no viene `confirmarSobreStock: true`, responde 409 con la lista de productos afectados |
| 04 | `POST /entradas` · `GET /entradas/recientes` | Varias líneas con una misma referencia; excluye `INV-INICIAL` |
| 05 | `POST /bajas` · `GET /bajas` · `GET /bajas/resumen` | Rechaza si la cantidad supera el stock; resumen por motivo valorado a precio de venta |
| 06 | `GET /inventario` · `GET /movimientos?productoId&desde&hasta` · `GET /inventario/:id/verificacion` | Productos bajo el mínimo primero |
| 07 | `GET/POST/PUT /proveedores` · `PATCH /proveedores/:id/activo` · `POST /proveedores/:id/precios` · `GET /productos/:id/precios` | Sin eliminar: solo desactivar |
| 08 | `GET /cuadres/dia?fecha=` · `POST /cuadres` · `GET /cuadres` | Día sin ventas → ceros |
| 09 | `GET /reportes/rotacion` · `GET /reportes/top-productos` · `GET /reportes/proveedores` | Mensaje claro si no hay datos |
| 15 | `GET /mensajes?pendientes=1` · `POST /mensajes/:id/alias` · `PATCH /mensajes/:id/revisado` | Los mensajes los escribirá el chat |

- **Errores:** siempre `{ error: { campo?: string, mensaje: string } }`, con los textos exactos del mockup, para que React los muestre debajo de cada campo.
- **Usuario de los movimientos:** fijo en `Isabel`, como en el mockup, hasta que se defina otra cosa (ver preguntas).

---

## 6. Cómo se trabaja con Claude Code (ciclo por cada HU)

```
TÚ                                   CLAUDE CODE
1. git pull                          (siempre en main)
2. claude  →  Shift+Tab x2 (modo Plan)
3. pegas el prompt de la HU  ───────►  lee CLAUDE.md, los criterios, el mockup
                                       propone un plan (sin tocar archivos)
4. revisas el plan; corriges o apruebas ►  implementa + pruebas
                                       corre typecheck y test
                                       reporta criterio por criterio
5. npm run dev → pruebas tú cada criterio en la app
6. pides correcciones si algo no coincide con el mockup
7. Claude Code hace commit local en main ◄─ (último commit: "Closes #1")
8. git log -3 y git show → revisas lo que se va a subir
9. git push                                        ← solo tú
10. /clear en Claude Code antes de la siguiente HU
```

**Buenas prácticas**
- **Una HU por sesión, y push al terminar cada HU.** Con `/clear` entre historias, Claude Code no mezcla contextos. Haciendo push por HU, el historial de `main` queda limpio y sirve de evidencia del avance.
- **Al trabajar directo en `main`, revisa antes de cada push.** No hay PR que te muestre los cambios, así que revísalos con `git show`. Si algo quedó mal, no lo subas: pídele a Claude Code que lo corrija con un commit nuevo. Nunca reescribas commits que ya subiste.
- **Si alguien más del equipo sube cambios,** haz `git pull` antes de abrir Claude Code para no tener conflictos.
- **Siempre empieza en modo Plan.** Si el plan menciona algo que no está en la HU o el mockup, recházalo antes de que escriba código.
- **Compara con el mockup lado a lado.** Abre `docs/mockup/mockup-aprobado.html` en el navegador junto a `npm run dev`. Si algo se ve o se lee distinto, pide corrección citando el texto exacto.
- **Si Claude Code anota algo en `docs/PREGUNTAS.md`,** resuélvelo con el equipo antes de seguir.
- **Toma capturas al terminar cada HU** y guárdalas en `docs/evidencias/` (son para la Sección 4).

**Plantilla de prompt para cada HU**
```
Vamos a implementar la HU-XX (issue #XX). Lee CLAUDE.md, ejecuta `gh issue view XX`
y revisa en docs/mockup/mockup-aprobado.html la pantalla "<nombre>" (funciones <vCat/vSale/...>).
Propón un plan que:
- liste cada criterio de aceptación y cómo lo vas a cumplir,
- reproduzca exactamente la interfaz, textos, mensajes y validaciones del mockup,
- incluya las rutas de API necesarias con validación Zod,
- incluya pruebas Vitest de las reglas de negocio de esta HU.
No implementes nada que no esté en la HU, el mockup o el README. Si algo falta o se contradice, pregúntame.
```

---

## 7. Fases

### Fase 0 — Base del proyecto
**Tú, antes de abrir Claude Code:**
1. Copia al repositorio `CLAUDE.md`, `.claude/settings.json` y `docs/PLAN.md`.
2. Guarda el mockup aprobado como `docs/mockup/mockup-aprobado.html`.
3. Haz commit y push de esos archivos a `main` para que el equipo los tenga.

**Prompt (modo Plan):**
```
Fase 0 de docs/PLAN.md. Crea el proyecto en desktop/ con electron-vite (plantilla react-ts),
la estructura de la sección 3 del plan, Vitest, el script typecheck, electron-builder para NSIS
en Windows (nombre "La Playa de las Mascotas", appId co.laplayadelasmascotas.app) y
.github/workflows/ci.yml que corra typecheck y test en cada push a main.
Agrega al .gitignore: node_modules, out, dist, dev-data, *.db, .claude/settings.local.json.
Crea docs/PREGUNTAS.md vacío con un encabezado.
El proceso main debe: pedir instancia única, abrir la BD en app.getPath('userData')/playa.db
(en desarrollo: desktop/dev-data/playa.db), arrancar Fastify en 127.0.0.1:3210 con GET /salud,
y luego abrir la ventana. Ajusta la Content-Security-Policy del index.html para permitir
connect-src http://127.0.0.1:3210.
Como better-sqlite3 se compila para Electron, configura el script de pruebas para correr Vitest
con ELECTRON_RUN_AS_NODE=1 usando el binario de Electron.
No implementes pantallas todavía.
```
**Listo cuando:** `npm run dev` abre una ventana vacía, `GET /salud` responde, y `npm test` y `npm run typecheck` pasan.

### Fase 1 — Esquema, reglas de negocio y armazón visual
```
Fase 1 de docs/PLAN.md. 
1) Crea desktop/src/server/db/schema.sql con el modelo de la sección 4 (CHECK, FK, UNIQUE,
   índices) y aplícalo al abrir la BD, usando PRAGMA user_version para versionar.
2) Crea funciones de dominio: stockDe(productoId), registrarMovimiento(...) (solo inserta, nunca
   actualiza ni borra), y el seed de demostración con los mismos 8 productos, alias, inventario
   inicial (INV-INICIAL), la venta V-000 y la baja del mockup (función seed()). El seed solo corre
   con `npm run seed`, nunca solo en la instalación de la tienda.
3) Pruebas: invariante de stock, una baja que supera el stock es rechazada, una venta que supera
   el stock sin confirmación devuelve conflicto y con confirmación se registra.
4) Armazón de React: copia el CSS del mockup tal cual a styles.css, el menú lateral (logo
   extraído del base64 del mockup, "Menú", ítems con sus íconos SVG, pie "Isabel Torres /
   Administradora"), y los componentes Modal, Toast y ask() con el mismo comportamiento.
   Las vistas quedan como marcadores vacíos.
```

### Fase 2 — HU con mockup (una por sesión, en este orden, push al terminar cada una)
| Orden | HU | Pantalla del mockup | Último commit |
|---|---|---|---|
| 1 | HU-01 Catálogo | `vCat`, `catList`, `pForm`, `pSave`, `tog` | `Closes #1` |
| 2 | HU-02 Alias | `aForm`, `aAdd`, `aDel` y búsqueda por alias | `Closes #2` |
| 3 | HU-03 Venta | `vSale`, `grid`, `cartR`, `sell`, `doSell` (incluye el cronómetro "meta < 4:00") | `Closes #3` |
| 4 | HU-04 Entradas | `vEnt`, `eSave` | `Closes #4` |
| 5 | HU-05 Bajas | `vBaj`, `bSave` | `Closes #5` |
| 6 | HU-06 Inventario | `vInv`, `mvList`, contador de alertas en el menú | `Closes #6` |

Usa la plantilla de la sección 6. En cada HU, pide que los cambios se reflejen sin recargar en todas las pantallas (HU-01 criterio 3): después de cada acción se vuelven a pedir los datos a la API.

### Fase 3 — HU sin mockup (resolver antes las preguntas 3, 4 y 5)
| HU | Antes de empezar |
|---|---|
| HU-07 Proveedores | Confirmar que el precio es **de compra** y qué "datos de contacto" se guardan |
| HU-08 Cuadre de caja | Ninguna |
| HU-09 Reportes | Definir de dónde salen las "compras" y los umbrales de rotación alta/media/baja |
| HU-15 Mensajes no entendidos | Acordar con quien haga el chat la tabla `mensajes` (sección 4) |

Estas pantallas no tienen mockup:
- Se construyen **solo con los componentes y estilos que ya existen en el mockup** (card, tb, tag, bar, in, b pri, modal, toast, alert).
- Se agregan al menú con el mismo formato.
- Antes de cerrar cada una, **muéstrasela a Isabel**. Esa validación sirve como evidencia de interacción (Sección 1.4) y de validación (Sección 5).

Prompt adicional para estas HU:
```
Esta HU no tiene pantalla en el mockup. Constrúyela usando únicamente los componentes y clases
CSS existentes del mockup, con la misma estructura de encabezado (h1 + .sub), tarjetas y tablas.
Antes de escribir la interfaz, muéstrame un boceto en texto de la pantalla para aprobarlo.
```

### Fase 4 — Instalador y despliegue en la tienda (Sección 4)
1. En tu PC con Windows: `cd desktop && npm run build:win`. El instalador queda en `desktop/dist/`.
2. Publica el `.exe` como *Release* en GitHub (`v1.0.0`). Así tienes una URL para el informe.
3. **Instalación en el PC de la tienda (con Isabel, en una reunión):**
   - Copia el instalador y ejecútalo. Como el .exe no está firmado, Windows muestra "Windows protegió su PC": se abre "Más información" y luego "Ejecutar de todas formas".
   - Abre la app y verifica que inicia vacía.
   - Carga el catálogo real (ver pregunta 6) y el inventario inicial.
   - Haz una venta, una entrada y una baja de prueba con Isabel.
4. Evidencias: fotos de la instalación, acta de la reunión y capturas de la app con datos reales.

### Fase 5 — Video tutorial
Recorrido de 5 a 8 minutos con datos de demostración (`npm run seed`), en el orden del menú: catálogo y alias, venta (mostrar el cronómetro), entrada, baja, inventario con alertas y verificación, proveedores, cuadre, reportes y mensajes. Súbelo como no listado a YouTube o a OneDrive de EAFIT y pon la URL en la Sección 4.

---

## 8. Evidencias para recoger mientras desarrollas

**Sección 4**
- URL del repositorio.
- URL de la Release con el .exe.
- URL del video.
- Una captura por pantalla, con 2 o 3 líneas de explicación cada una.
- Fotos de la instalación en la tienda.

**Sección 5 (indicadores del README, sección 7)**

| Indicador | Cómo medirlo con la app |
|---|---|
| Registro de pedido de 8 → 4 min | El cronómetro de "Nueva venta" muestra el tiempo de cada venta en el mensaje de confirmación. Anota los tiempos de 10 o más ventas de prueba con Isabel. |
| 90 % de cobros en menos de 4 min | Con esos mismos tiempos. |
| 95 % de precisión en entradas y salidas | Conteo físico de 10 productos frente al stock de la pantalla Inventario. |
| Reporte de más vendidos y proveedores principales | Captura del reporte de HU-09. |
| Percepción de mejora mayor al 85 % | Encuesta corta a Isabel después del piloto. |
| Satisfacción mayor al 80 % (personal de mostrador) | Aplica al chat; queda para quien lo desarrolle. |

- **Tabla ANTES → DESPUÉS:** en la reunión de instalación, anota frases textuales de Isabel. Si es posible, grábala o pídele que las envíe por correo; eso sirve más que un chat de WhatsApp.

---

## 9. Preguntas abiertas (resolver con el equipo o con Isabel)

1. **Usuario:** el mockup no tiene inicio de sesión y registra todo a nombre de "Isabel". ¿Se mantiene así en la app de escritorio?
2. **Formato de fecha:** el mockup muestra "12 nov., 14:30" y el README pide DD/MM/AAAA. Por la regla de seguir el mockup al pie de la letra, el plan usa el formato del mockup. ¿Se confirma?
3. **HU-07:** ¿"el precio al que se vende" es el precio **de compra** al proveedor? ¿Qué "datos de contacto" se guardan (un solo campo, o teléfono y correo)?
4. **HU-09:** ¿de dónde salen las "compras" para el reporte de proveedores, si las entradas no guardan proveedor? ¿Con qué umbrales se clasifica la rotación como alta, media o baja? ¿Top 3 o top 5 proveedores?
5. **HU-15:** ¿quién define la tabla de mensajes del chat? El plan propone la de la sección 4.
6. **Carga inicial del catálogo real:** ¿la digita Isabel en la app, o el equipo la carga desde su Excel?
7. **Copias de seguridad de `playa.db`:** no están en el backlog. ¿Se agregan como tarea o se dejan como trabajo futuro (Sección 7)?
8. **Inconsistencias del backlog** (se unifican al final): el sprint de HU-07 a HU-09 y las dependencias de HU-11, HU-12 y HU-15 consigo mismas.
