-- Esquema v2 (PRAGMA user_version = 2): proveedores y precios (HU-07), compras por proveedor (HU-09),
-- cuadre de caja (HU-08) y mensajes del chat (HU-15). Decisiones en docs/PREGUNTAS.md (18 a 24).

-- HU-07: proveedores con teléfono y correo opcionales. Se desactivan, no se eliminan.
CREATE TABLE proveedores (
  id        INTEGER PRIMARY KEY,
  nombre    TEXT    NOT NULL CHECK (length(trim(nombre)) > 0),
  telefono  TEXT,
  correo    TEXT,
  activo    INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  creado_en TEXT    NOT NULL
);
CREATE TRIGGER proveedores_sin_borrar BEFORE DELETE ON proveedores
BEGIN SELECT RAISE(ABORT, 'Los proveedores se desactivan, no se eliminan.'); END;

-- HU-07: historial de precios de compra (lo que el proveedor le cobra a la tienda por unidad).
-- Es un historial: los precios no se editan ni se borran; un precio nuevo es una fila nueva.
CREATE TABLE precios_proveedor (
  id            INTEGER PRIMARY KEY,
  proveedor_id  INTEGER NOT NULL REFERENCES proveedores (id),
  producto_id   INTEGER NOT NULL REFERENCES productos (id),
  precio        INTEGER NOT NULL CHECK (precio > 0),
  fecha         TEXT    NOT NULL, -- día del precio, AAAA-MM-DD (hora de Colombia)
  registrado_en TEXT    NOT NULL
);
CREATE INDEX idx_precios_producto ON precios_proveedor (producto_id, proveedor_id, fecha);
CREATE TRIGGER precios_sin_editar BEFORE UPDATE ON precios_proveedor
BEGIN SELECT RAISE(ABORT, 'Los precios no se editan.'); END;
CREATE TRIGGER precios_sin_borrar BEFORE DELETE ON precios_proveedor
BEGIN SELECT RAISE(ABORT, 'Los precios no se borran.'); END;

-- HU-09: proveedor opcional de cada entrada (las compras del reporte de proveedores).
ALTER TABLE movimientos ADD COLUMN proveedor_id INTEGER REFERENCES proveedores (id);

-- HU-08: un cuadre por día. Guarda los totales del momento en que se hizo. No se edita ni se borra.
CREATE TABLE cuadres_caja (
  id               INTEGER PRIMARY KEY,
  dia              TEXT    NOT NULL UNIQUE, -- AAAA-MM-DD (hora de Colombia)
  total_efectivo   INTEGER NOT NULL CHECK (total_efectivo >= 0),
  total_digital    INTEGER NOT NULL CHECK (total_digital >= 0),
  efectivo_contado INTEGER NOT NULL CHECK (efectivo_contado >= 0),
  diferencia       INTEGER NOT NULL, -- contado − esperado en efectivo
  usuario          TEXT    NOT NULL,
  creado_en        TEXT    NOT NULL
);
CREATE TRIGGER cuadres_sin_editar BEFORE UPDATE ON cuadres_caja
BEGIN SELECT RAISE(ABORT, 'Los cuadres no se editan.'); END;
CREATE TRIGGER cuadres_sin_borrar BEFORE DELETE ON cuadres_caja
BEGIN SELECT RAISE(ABORT, 'Los cuadres no se borran.'); END;

-- HU-15: mensajes del chat (los escribirá el chat operativo, HU-10 a HU-14).
CREATE TABLE mensajes (
  id          INTEGER PRIMARY KEY,
  texto       TEXT    NOT NULL,
  usuario     TEXT    NOT NULL,
  fecha       TEXT    NOT NULL,
  estado      TEXT    NOT NULL CHECK (estado IN ('confirmado', 'corregido', 'no_entendido')),
  revisado    INTEGER NOT NULL DEFAULT 0 CHECK (revisado IN (0, 1)),
  producto_id INTEGER REFERENCES productos (id), -- producto al que Isabel asoció el texto (HU-15)
  alias_texto TEXT                               -- alias que se creó desde el mensaje
);
CREATE INDEX idx_mensajes_pendientes ON mensajes (estado, revisado);
CREATE TRIGGER mensajes_sin_borrar BEFORE DELETE ON mensajes
BEGIN SELECT RAISE(ABORT, 'Los mensajes no se borran.'); END;
