# La Playa de las Mascotas — Sistema de inventario y ventas

Proyecto de aula del curso **Sistemas de Información (4408)**, Universidad EAFIT, 2026.

---

## 1. Qué es este proyecto

Un sistema de gestión de inventario y ventas hecho a la medida de **La Playa de las Mascotas**, una tienda de productos para mascotas. Reemplaza la libreta física que hoy usa el negocio por un registro centralizado que descuenta stock con cada venta y deja trazabilidad de cada movimiento.

La solución se construye sobre un principio: **un solo backend y dos clientes**, cada uno adaptado al perfil de quien lo usa.

| Componente | Usuario | Descripción |
|---|---|---|
| **Aplicación de escritorio** | Administradora | Catálogo, ventas, entradas, bajas, inventario, proveedores, cuadre de caja y reportes. |
| **Chat operativo** | Personal de mostrador | Interfaz de mensajería desde el celular para reportar ventas, entradas y bajas con mensajes cortos. Es su única interfaz. |
| **Backend compartido** | — | API y base de datos únicas: catálogo, ventas, movimientos de stock y registro de mensajes. |

---

## 2. Contexto del negocio

- **Empresa:** La Playa de las Mascotas. Empresa familiar fundada en 2017.
- **Sector:** comercio minorista (retail) de productos para mascotas: alimentos (concentrado), juguetes, camas, collares y artículos de cuidado para perros, gatos y otras mascotas.
- **Tamaño:** microempresa de **tres personas**.
- **Misión:** comercializar productos para el cuidado, alimentación y bienestar de las mascotas en su barrio, con atención cercana, confiable y de calidad.
- **Visión 2028:** ser tienda de referencia en el barrio, con excelente gestión de inventario y un aumento del 20% en utilidades netas frente a 2026.

### Situación actual (antes del sistema)

- El inventario y las ventas se anotan **a mano en una libreta física**, de forma empírica y según la memoria del personal.
- Las compras se comparan en un **Excel** que se alimenta manualmente.
- Pedidos, domicilios, atención y postventa se manejan por **WhatsApp e Instagram**.
- **No hay** sistema de punto de venta (POS), lectores de código de barras ni facturación sistematizada.
- Las herramientas no se comunican entre sí.

### Problema que se resuelve

> La Playa de las Mascotas necesita centralizar y estandarizar el registro de entradas y salidas de mercancía y de ventas, de forma que pueda ser operado por el personal de mostrador con baja alfabetización digital sin aumentar su carga operativa, y que la información acumulada permita a la administración conocer las existencias, identificar los productos y proveedores más relevantes y tomar decisiones de compra informadas.

Causas raíz identificadas: no hay un procedimiento estandarizado para registrar entradas y salidas, no se puede analizar el historial de ventas por producto, y hay alta carga operativa sobre el personal de mayor edad.

---

## 3. Usuarios

| Persona | Rol | Cliente que usa | Perfil |
|---|---|---|---|
| **Administradora** | Dueña del negocio. Dirección general. Product Owner del proyecto. | Aplicación de escritorio | Maneja Excel, portales bancarios y de la DIAN. Toma las decisiones de compra. |
| **Auxiliar de logística** | Logística, domicilios y despachos. | Chat operativo | **Baja alfabetización digital.** Hoy usa la libreta y WhatsApp. |
| **Auxiliar comercial** | Ventas y atención al cliente. | Chat operativo | **Baja alfabetización digital.** Hoy usa la libreta y WhatsApp. |

**El personal de mostrador (auxiliares) no accede a la aplicación de escritorio.** Su adopción es el principal riesgo del proyecto.

---

## 4. Principios de diseño (obligatorios)

1. **Simplicidad ante todo.** Cada decisión de diseño debe preferir lo más simple. La curva de aprendizaje para el personal de mostrador debe ser mínima.
2. **No aumentar la carga operativa.** El sistema no puede pedirles más pasos que la libreta.
3. **Interfaz en español**, con lenguaje cotidiano. Nada de jerga técnica en pantalla.
4. **Accesibilidad para adultos mayores:** letra grande, botones grandes, pocas opciones por pantalla, mensajes claros, confirmaciones de un toque.
5. **Los productos se reconocen por el nombre cotidiano** (alias), no por códigos. El personal dice "chow", no "Concentrado Dog Chow Adulto 8kg".
6. **Trazabilidad total:** toda variación de stock es un movimiento con tipo, cantidad, usuario y fecha. Nada se borra; lo desactivado conserva su historial.
7. **No complicar la arquitectura.** Es una tienda de tres personas con recursos limitados. Evitar sobreingeniería.

---

## 5. Alcance

### Dentro del alcance

Cuatro procesos del negocio:

| Proceso | Aporte de la solución |
|---|---|
| Gestión de inventario | Registro de entradas y bajas, stock actualizado en tiempo real. |
| Gestión de facturación | Venta rápida, descuento automático de stock, base para el cuadre de caja. |
| Planeación de compras con proveedores | Registro de proveedores e historial de precios. |
| Análisis de inventario y productos | Clasificación por rotación, productos más vendidos y top 5 proveedores. |

### Fuera del alcance (no implementar)

- Canales digitales de venta, comercio electrónico y marketing (WhatsApp e Instagram ya cumplen esa función).
- Gestión contable y tributaria (DIAN, declaraciones, impuestos).
- Automatización de procesos externos: envío de pedidos a proveedores, redacción de correos.
- RPA, ETL, ESB, IA predictiva. Se evaluó y se descartó: el problema es que no existe un sistema de registro, no que falte automatizar uno existente.
- Integración con ERP o CRM comerciales.

---

## 6. Arquitectura

```
┌──────────────────────┐        ┌──────────────────────┐
│ Aplicación escritorio│        │   Chat operativo     │
│  (Administradora)    │        │ (Personal mostrador) │
└──────────┬───────────┘        └──────────┬───────────┘
           │                               │
           └────────────┬──────────────────┘
                        ▼
              ┌──────────────────┐
              │  Backend (API)   │
              └────────┬─────────┘
                       ▼
              ┌──────────────────┐
              │  Base de datos   │
              │      única       │
              └──────────────────┘
```

### Reglas de negocio centrales

- **Stock = entradas − ventas − bajas.** Esta invariante debe cumplirse siempre; el sistema la muestra y verifica.
- Cada venta descuenta stock automáticamente.
- Tres tipos de movimiento: `venta`, `entrada`, `baja`. Cada uno guarda usuario y fecha.
- Una venta que supera el stock disponible **se rechaza** (igual que las bajas): no se registra ninguna línea y se indica el stock disponible de cada producto. El stock nunca puede quedar negativo. Las cantidades del mismo producto repetido en varias líneas se suman antes de comparar.
- Una baja que supera el stock actual **sí se rechaza**.
- Las bajas requieren un motivo: `vencido`, `dañado` u `otro`.
- Las entradas requieren referencia de factura o remisión; una recepción puede incluir varios productos con la misma referencia.
- Un producto desactivado no aparece en los selectores de venta, entrada o baja, pero su historial se conserva.
- Un alias pertenece a un solo producto (comparación sin distinguir mayúsculas/minúsculas).
- Métodos de pago de la venta: `efectivo` o `digital`.

### Stack técnico

| Decisión | Valor |
|---|---|
| Lenguaje y framework del backend | **TypeScript** con **Fastify 5** y validación con **Zod 4**. API local embebida en el proceso principal de Electron, escuchando en `127.0.0.1:3210`. |
| Base de datos | **SQLite** a través de **better-sqlite3** (SQL plano, sin ORM). Archivo único `playa.db`: en desarrollo `desktop/dev-data/playa.db`; instalada, en la carpeta de datos de la app del usuario (Windows). |
| Aplicación de escritorio | **Electron 42** empaquetado con **electron-vite**; interfaz en **React 19** + TypeScript. |
| Chat operativo (web móvil / WhatsApp API / otro) | Chat propio dentro del mismo backend (rutas de mensajes en la API). WhatsApp queda fuera del alcance de esta versión. |
| Dónde se despliega (servidor, nube o equipo de la tienda) | **Equipo de la tienda (la administradora).** Instalador de Windows (**NSIS**, `electron-builder`) con API y base de datos embebidas; no requiere servidor ni nube. |

Restricciones: costo mínimo o cero, el equipo está aprendiendo las herramientas, y el sistema debe poder instalarse en los recursos que ya tenga la tienda.

## 7. Indicadores de éxito

Metas acordadas para evaluar la solución:

- Reducir el tiempo promedio de registro de un pedido en mostrador de 8 a 4 minutos.
- Tasa de precisión del 95% en la captura de entradas y salidas durante las pruebas piloto.
- Satisfacción de uso superior al 80% en pruebas de usabilidad con el personal de mostrador.
- Que el 90% de las simulaciones de cobro en punto de pago se completen en menos de 4 minutos.
- Un reporte básico que identifique los productos más vendidos y los 3 proveedores principales.
- Percepción de mejora en la atención y la permanencia superior al 85% según la administradora.

## 8. Convenciones para el desarrollo

- **Idioma:** interfaz, mensajes de error y documentación de usuario en español. Nombres de código a criterio del equipo, pero consistentes.
- **Cada historia de usuario debe cumplir todos sus criterios de aceptación.** Los mensajes de la sección 7 son el texto esperado en pantalla; úselos literalmente.
- **Validar siempre en el backend**, no solo en la interfaz (cantidades enteras positivas, productos existentes y activos, precios > 0, motivo obligatorio en bajas, referencia obligatoria en entradas).
- **Nunca borrar movimientos.** Las correcciones se hacen con movimientos nuevos.
- **Moneda:** pesos colombianos (COP), sin decimales en pantalla.
- **Fechas:** formato DD/MM/AAAA, zona horaria de Colombia.
- **Pruebas:** incluir pruebas para las reglas de negocio de la sección 6, en especial la invariante de stock y el rechazo de bajas que superan el stock.
- **Datos de ejemplo:** usar productos reales de una tienda de mascotas (concentrados, collares, juguetes, camas) con alias cotidianos (ej. "chow", "pedigree") para pruebas y demostraciones.
- **Ante la duda, elegir lo más simple** y dejar la pregunta documentada para el equipo en vez de ampliar el alcance.

---

## 9. Cómo ejecutar el proyecto

### Requisitos previos

- **Node.js 24** (es la versión que usa la integración continua). Incluye `npm`.
- **Sistema operativo:** Windows para generar el instalador. El desarrollo y las pruebas también funcionan en macOS/Linux.
- **Git** para clonar el repositorio.
- No se requiere instalar ninguna base de datos aparte: SQLite va embebida mediante `better-sqlite3`.

> `better-sqlite3` es un módulo nativo. Al instalar las dependencias, el script `postinstall` (`electron-builder install-app-deps`) lo recompila contra la versión de Electron del proyecto. Por eso las pruebas y el *seed* se corren con el binario de Electron (ver `scripts/electron-node.mjs`).

### Dependencias y librerías

**Producción**

| Librería | Para qué sirve |
|---|---|
| `fastify` | Servidor HTTP de la API local. |
| `zod` | Validación de datos en la API (reglas de negocio). |
| `better-sqlite3` | Acceso síncrono a la base de datos SQLite. |

**Desarrollo**

| Librería | Para qué sirve |
|---|---|
| `electron` | Entorno de la aplicación de escritorio. |
| `electron-vite` | Compilación y servidor de desarrollo de Electron + Vite. |
| `electron-builder` | Empaquetado e instalador NSIS para Windows. |
| `react`, `react-dom`, `@vitejs/plugin-react` | Interfaz de la aplicación. |
| `vite` | Empaquetador del *renderer*. |
| `vitest` | Pruebas de las reglas de negocio. |
| `typescript` | Lenguaje y chequeo de tipos. |
| `@types/*` | Tipos de Node, React y better-sqlite3. |

### Pasos

1. **Clonar e instalar dependencias**

   Si aún no lo has clonado:

   ```bash
   git clone <url-del-repositorio>
   cd la-playa-de-las-mascotas
   ```

   Ya dentro del repositorio, entra a `desktop/` e instala:

   ```bash
   cd desktop
   npm install
   ```

   `npm install` dispara `postinstall`, que recompila `better-sqlite3` para Electron.

2. **Cargar datos de ejemplo** (opcional pero recomendado la primera vez)

   ```bash
   npm run seed
   ```

   Crea/pobla la base de datos de desarrollo en `desktop/dev-data/playa.db` con productos y alias de ejemplo.

3. **Ejecutar la aplicación en modo desarrollo**

   ```bash
   npm run dev
   ```

   Abre la ventana de Electron con recarga en caliente. El proceso principal levanta la API en `http://127.0.0.1:3210`.

### Otros comandos útiles

| Comando | Qué hace |
|---|---|
| `npm run typecheck` | Verifica los tipos (Node + interfaz) sin generar archivos. |
| `npm test` | Ejecuta las pruebas con Vitest sobre el binario de Electron. |
| `npm run build` | Compila la aplicación (sin generar instalador). |
| `npm run build:win` | Compila y genera el instalador NSIS para Windows en `desktop/dist/` (también en GitHub Actions: workflow «Instalador Windows»). |

### Instalación en el equipo de la tienda

Esta guía es para instalar la app en el PC de la tienda (Windows 10 u 11), paso a paso. No se necesita saber programar.

**a) Conseguir el instalador**

El instalador es un solo archivo: `La-Playa-de-las-Mascotas-Setup-1.0.0.exe`. Hay dos formas de obtenerlo:

- **Desde GitHub (no requiere tener Windows con el proyecto):** en el repositorio, abre la pestaña **Actions** → **Instalador Windows** → **Run workflow** → **Run workflow**. Cuando termine (marca verde, unos 10 minutos), entra a esa ejecución y, abajo en **Artifacts**, descarga `instalador-windows`. Es un `.zip`: ábrelo y saca el `.exe`. También se genera solo al subir un tag que empiece por `v` (por ejemplo `v1.0.0`).
- **En un PC con Windows y el proyecto:** dentro de `desktop/`, corre `npm run build:win`. El archivo queda en `desktop/dist/`.

Copia el `.exe` al PC de la tienda (por USB, correo o Drive).

**b) Instalar**

1. Haz doble clic en el `.exe`.
2. Si aparece la ventana azul **«Windows protegió su PC»**, es normal: el instalador no está firmado digitalmente. Toca **«Más información»** y luego **«Ejecutar de todas formas»**.
3. Sigue el asistente (puedes dejar la carpeta que propone) y toca **Instalar**. Al final queda un acceso directo **La Playa de las Mascotas** en el escritorio y en el menú Inicio.

**c) Abrir la app una vez y cerrarla**

Abre la app desde el acceso directo. La primera vez crea su base de datos **vacía**, sin productos de ejemplo. Isabel empieza a cargar el catálogo desde cero. Luego ciérrala.

**d) Configurar el chat de Telegram (archivo `.env`)**

1. Presiona las teclas **Windows + R**, escribe `%APPDATA%\La Playa de las Mascotas` y presiona **Enter**. Se abre la carpeta de datos de la app (ahí está `playa.db`).
2. Copia en esa carpeta el archivo `.env.ejemplo` que está en la raíz del repositorio y cámbiale el nombre a **`.env`**: sin «.ejemplo» y sin «.txt» al final. Para ver la extensión real, en el Explorador activa **Vista → Mostrar → Extensiones de nombre de archivo**.
3. Abre `.env` con el Bloc de notas y escribe después de cada `=`, sin espacios ni comillas:
   - `TELEGRAM_BOT_TOKEN=`: el token del bot. Lo da **@BotFather** en Telegram al crear el bot (`/newbot`); si ya existe, con `/mybots` → el bot → **API Token**. Se ve así: `123456789:AAE…`.
   - `TELEGRAM_CHATS_AUTORIZADOS=`: los chat IDs de Alirio y Olga separados por coma, por ejemplo `111111111,222222222`.
4. **Cómo obtener el chat ID de cada persona** (por ahora deja `TELEGRAM_CHATS_AUTORIZADOS=` vacío y guarda el `.env` solo con el token):
   1. Abre la app.
   2. Alirio, desde su celular, busca el bot en Telegram y le escribe `/start`. El bot le dirá que el chat es solo para el personal: es normal. Olga hace lo mismo.
   3. En la misma carpeta abre `telegram.log` con el Bloc de notas. Aparece una línea por cada uno, así: `Mensaje de un chat no autorizado: 123456789 (Alirio)…`. Ese número es su chat ID.
   4. Cierra la app y escribe los dos números en el `.env`: `TELEGRAM_CHATS_AUTORIZADOS=123456789,987654321`. Guarda.

   Otra forma: cada persona le escribe a **@userinfobot** en Telegram, y ese bot le responde con su **Id**.

**e) Probar el bot**

Vuelve a abrir la app. Desde el celular de Alirio u Olga, escribe `/start` al bot: debe responder el saludo con los botones «Registrar venta», «Registrar entrada», «Registrar baja» y «Consultar precio y stock». Si no responde, abre `telegram.log`: ahí queda si no encontró el token, si un chat no está autorizado o si hubo un error de red.

**f) Dónde quedan los datos y cómo hacer una copia de seguridad**

- Todo queda en `%APPDATA%\La Playa de las Mascotas`:
  - `playa.db`: la base de datos con productos, ventas, entradas, bajas, proveedores y cuadres.
  - `.env`: la configuración del chat.
  - `telegram.log`: el registro del bot.
- **Copia de seguridad:** cierra la app y copia `playa.db` a una memoria USB o a Drive, con la fecha en el nombre (ej. `playa-2026-11-14.db`). Si existen `playa.db-wal` y `playa.db-shm`, cópialos también. Hazlo al menos una vez por semana.
- **Para restaurar:** con la app cerrada, pon la copia en esa carpeta con el nombre `playa.db`.
- Desinstalar, actualizar o reinstalar la app **no borra** esta carpeta: los datos se conservan. Para actualizar, basta con instalar el `.exe` nuevo encima.

**g) Importante: el chat solo funciona con la app abierta**

El chat de Telegram de Alirio y Olga **solo responde mientras la app esté abierta en el PC de la tienda** (y el PC con internet). Si la app está cerrada o el PC apagado, el bot no responde. Telegram guarda los mensajes hasta por 24 horas y el bot los atiende cuando se vuelve a abrir la app, pero lo seguro es registrar solo cuando el bot conteste. Lo recomendado es abrir la app al llegar y dejarla abierta durante toda la jornada.

### Notas

- La aplicación solo permite **una instancia a la vez** (no puede haber dos APIs sobre la misma base de datos).
- La API escucha únicamente en `127.0.0.1` (localhost); no se expone a la red.
- El endpoint `GET /salud` responde `{ ok: true, db: true }` cuando la API y la base de datos están activas.
