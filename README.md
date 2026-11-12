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
- Una venta que supera el stock disponible **no se bloquea**: se advierte y se exige confirmación explícita (el stock real a veces no coincide con el registrado).
- Una baja que supera el stock actual **sí se rechaza**.
- Las bajas requieren un motivo: `vencido`, `dañado` u `otro`.
- Las entradas requieren referencia de factura o remisión; una recepción puede incluir varios productos con la misma referencia.
- Un producto desactivado no aparece en los selectores de venta, entrada o baja, pero su historial se conserva.
- Un alias pertenece a un solo producto (comparación sin distinguir mayúsculas/minúsculas).
- Métodos de pago de la venta: `efectivo` o `digital`.

### Stack técnico — `POR DEFINIR`

| Decisión | Valor |
|---|---|
| Lenguaje y framework del backend | `POR DEFINIR` |
| Base de datos | `POR DEFINIR` *(el plan inicial contemplaba SQLite)* |
| Aplicación de escritorio | `POR DEFINIR` |
| Chat operativo (web móvil / WhatsApp API / otro) | `POR DEFINIR` *(se previó un chat propio dentro de la app como canal principal; WhatsApp solo si resulta viable y de bajo costo)* |
| Dónde se despliega (servidor, nube o equipo de la tienda) | `POR DEFINIR` *(se consulta con la administradora qué recursos tiene)* |

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