-- Esquema v1 (PRAGMA user_version = 1): catálogo, alias, ventas y movimientos (HU-01 a HU-06).
-- Las tablas de HU-07, HU-08, HU-09 y HU-15 se agregan como migraciones nuevas cuando se aprueben.
-- Fechas: texto ISO 8601 en UTC (ej. 2026-11-12T19:30:00.000Z). Se muestran en America/Bogota.

CREATE TABLE productos (
  id           INTEGER PRIMARY KEY,
  nombre       TEXT    NOT NULL CHECK (length(trim(nombre)) > 0),
  categoria    TEXT    NOT NULL CHECK (length(trim(categoria)) > 0),
  precio_venta INTEGER NOT NULL CHECK (precio_venta > 0),
  stock_minimo INTEGER NOT NULL CHECK (stock_minimo >= 0),
  activo       INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  creado_en    TEXT    NOT NULL
);

CREATE TABLE alias (
  id                INTEGER PRIMARY KEY,
  producto_id       INTEGER NOT NULL REFERENCES productos (id),
  texto             TEXT    NOT NULL CHECK (length(trim(texto)) > 0),
  texto_normalizado TEXT    NOT NULL UNIQUE -- texto en minúsculas: alias únicos sin distinguir mayúsculas
);
CREATE INDEX idx_alias_producto ON alias (producto_id);

CREATE TABLE ventas (
  id          INTEGER PRIMARY KEY,
  consecutivo TEXT    NOT NULL UNIQUE, -- V-001
  metodo_pago TEXT    NOT NULL CHECK (metodo_pago IN ('efectivo', 'digital')),
  usuario     TEXT    NOT NULL,
  fecha       TEXT    NOT NULL
);

-- Stock = entradas − ventas − bajas. No hay columna de stock: se calcula desde aquí.
CREATE TABLE movimientos (
  id              INTEGER PRIMARY KEY,
  producto_id     INTEGER NOT NULL REFERENCES productos (id),
  tipo            TEXT    NOT NULL CHECK (tipo IN ('venta', 'entrada', 'baja')),
  cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
  motivo          TEXT    NOT NULL, -- venta: efectivo/digital · entrada: Recepción · baja: vencido/dañado/otro
  referencia      TEXT,             -- venta: consecutivo · entrada: factura o remisión
  detalle         TEXT,             -- baja: texto opcional
  venta_id        INTEGER REFERENCES ventas (id),
  precio_unitario INTEGER CHECK (precio_unitario IS NULL OR precio_unitario > 0),
  usuario         TEXT    NOT NULL,
  fecha           TEXT    NOT NULL,
  CHECK (tipo <> 'entrada' OR length(trim(coalesce(referencia, ''))) > 0),
  CHECK (tipo <> 'baja' OR motivo IN ('vencido', 'dañado', 'otro')),
  CHECK (tipo <> 'venta' OR (motivo IN ('efectivo', 'digital') AND venta_id IS NOT NULL AND precio_unitario IS NOT NULL))
);
CREATE INDEX idx_mov_producto ON movimientos (producto_id);
CREATE INDEX idx_mov_fecha ON movimientos (fecha);
CREATE INDEX idx_mov_tipo_ref ON movimientos (tipo, referencia);

-- Los movimientos nunca se borran ni se editan. Los productos se desactivan, no se eliminan.
CREATE TRIGGER movimientos_sin_editar BEFORE UPDATE ON movimientos
BEGIN SELECT RAISE(ABORT, 'Los movimientos no se editan.'); END;
CREATE TRIGGER movimientos_sin_borrar BEFORE DELETE ON movimientos
BEGIN SELECT RAISE(ABORT, 'Los movimientos no se borran.'); END;
CREATE TRIGGER productos_sin_borrar BEFORE DELETE ON productos
BEGIN SELECT RAISE(ABORT, 'Los productos se desactivan, no se eliminan.'); END;
CREATE TRIGGER ventas_sin_editar BEFORE UPDATE ON ventas
BEGIN SELECT RAISE(ABORT, 'Las ventas no se editan.'); END;
CREATE TRIGGER ventas_sin_borrar BEFORE DELETE ON ventas
BEGIN SELECT RAISE(ABORT, 'Las ventas no se borran.'); END;
