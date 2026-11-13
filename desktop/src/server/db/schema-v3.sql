-- Esquema v3 (PRAGMA user_version = 3): el cuadre de caja compara el monto total contado
-- (efectivo + digital) con el total vendido (docs/PREGUNTAS.md, 25).
-- Desde v3: diferencia = (efectivo contado + digital recibido) − (ventas en efectivo + digitales).
-- Los cuadres guardados antes de v3 quedan con digital_contado NULL y su diferencia original (solo efectivo).
ALTER TABLE cuadres_caja ADD COLUMN digital_contado INTEGER CHECK (digital_contado IS NULL OR digital_contado >= 0);
