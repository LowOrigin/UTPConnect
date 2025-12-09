-- migration_improved.sql
-- Migración mejorada para sistema_buses
-- Incluye: columnas coord_x/coord_y, route/orden, campos en buses, trigger con pg_notify,
-- vistas para API y ejemplos de población.
-- === ADVERTENCIA: Hacer BACKUP antes de ejecutar en producción ===

-- -------------------------
-- Limpieza segura (idempotente)
-- -------------------------
DROP TRIGGER IF EXISTS trg_telemetria_after_insert ON telemetria;
DROP FUNCTION IF EXISTS fn_after_insert_telemetria_notify();
DROP VIEW IF EXISTS vw_paradas_realtime;
DROP VIEW IF EXISTS vw_buses_realtime;

-- (No borramos tablas automáticamente aquí para no perder datos; asumimos que ya existen)
-- Si quieres recrear desde cero, ejecuta tu script base primero.

-- -------------------------
-- Crear/asegurar tipos ENUM
-- -------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bus_state') THEN
    CREATE TYPE bus_state AS ENUM ('llego_parada','en_camino','detenido','fuera_de_servicio');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'parada_state') THEN
    CREATE TYPE parada_state AS ENUM ('activa','sin_comunicacion','mantenimiento');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'realtime_status_type') THEN
    CREATE TYPE realtime_status_type AS ENUM ('idle','approaching','arrived');
  END IF;
END $$;

-- -------------------------
-- TABLA: paradas (stops) - añadir columnas si faltan
-- -------------------------
ALTER TABLE paradas
  ADD COLUMN IF NOT EXISTS coord_x DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS coord_y DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS route_id TEXT,
  ADD COLUMN IF NOT EXISTS orden INTEGER,
  ADD COLUMN IF NOT EXISTS current_bus_id TEXT,        -- último bus asociado en tiempo real (puede ser null)
  ADD COLUMN IF NOT EXISTS realtime_status realtime_status_type DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS last_event_ts TIMESTAMP WITH TIME ZONE;

-- índices útiles para UI y lookups
CREATE INDEX IF NOT EXISTS idx_paradas_coord ON paradas(coord_x, coord_y);
CREATE INDEX IF NOT EXISTS idx_paradas_route_orden ON paradas(route_id, orden);
CREATE INDEX IF NOT EXISTS idx_paradas_route ON paradas(route_id);

-- -------------------------
-- TABLA: buses - añadir columnas si faltan
-- -------------------------
ALTER TABLE buses
  ADD COLUMN IF NOT EXISTS current_parada_id TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_ts TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS capacidad_maxima INTEGER,
  ADD COLUMN IF NOT EXISTS battery_level INTEGER,
  ADD COLUMN IF NOT EXISTS additional_info JSONB;

CREATE INDEX IF NOT EXISTS idx_buses_current_parada ON buses(current_parada_id);

-- -------------------------
-- TABLA: telemetria - asegurar FK y columnas básicas
-- -------------------------
-- Asumimos que telemetria ya existe. Si no, crear según tu script original.
-- Asegurarse que referencias a paradas(bus parada_id) y buses(bus_id) están presentes
-- (las referencias funcionan si paradas.parada_id y buses.bus_id son UNIQUE).
ALTER TABLE telemetria
  ADD COLUMN IF NOT EXISTS route_id TEXT,
  ADD COLUMN IF NOT EXISTS orden INTEGER;

CREATE INDEX IF NOT EXISTS idx_telemetria_route_ts ON telemetria(route_id, ts DESC);

-- -------------------------
-- FUNCION TRIGGER: actualizar tablas + NOTIFY (pg_notify)
-- -------------------------
-- Versión corregida: new_status es del tipo enum realtime_status_type
CREATE OR REPLACE FUNCTION fn_after_insert_telemetria_notify()
RETURNS TRIGGER AS $$ 
DECLARE
  seq_val BIGINT;
  new_status realtime_status_type := 'idle'::realtime_status_type;
  p_route TEXT;
  p_orden INT;
  next_pid TEXT;
  payload JSONB;
BEGIN
  -- extraer seq si existe
  seq_val := NULL;
  IF NEW.raw_payload IS NOT NULL AND (NEW.raw_payload ? 'seq') THEN
    BEGIN
      seq_val := (NEW.raw_payload->>'seq')::BIGINT;
    EXCEPTION WHEN others THEN
      seq_val := NULL;
    END;
  END IF;

  -- determinar status simple a partir de evento textual (convertimos a enum)
  IF NEW.evento IS NOT NULL THEN
    IF LOWER(NEW.evento) LIKE '%llego%' OR LOWER(NEW.evento) LIKE '%arriv%' THEN
      new_status := 'arrived'::realtime_status_type;
    ELSIF LOWER(NEW.evento) LIKE '%detect%' OR LOWER(NEW.evento) LIKE '%detectado%' OR LOWER(NEW.evento) LIKE '%camino%' OR LOWER(NEW.evento) LIKE '%aproxim%' THEN
      new_status := 'approaching'::realtime_status_type;
    ELSE
      new_status := 'idle'::realtime_status_type;  -- Caso "idle"
    END IF;
  END IF;

  -- Si el estado es 'idle', no asignar el bus a la parada, poner current_bus_id como NULL
  IF new_status = 'idle' THEN
    UPDATE paradas
    SET ultima_conexion_bus = NEW.ts,
        ultima_actualizacion = NEW.ts,
        current_bus_id = NULL,  -- Asignamos NULL en lugar del bus actual
        realtime_status = new_status,
        last_event_ts = NEW.ts
    WHERE parada_id = NEW.parada_id;
  ELSE
    -- Si no es 'idle', actualizamos el bus normalmente
    UPDATE paradas
    SET ultima_conexion_bus = NEW.ts,
        ultima_actualizacion = NEW.ts,
        current_bus_id = NEW.bus_id,
        realtime_status = new_status,
        last_event_ts = NEW.ts
    WHERE parada_id = NEW.parada_id;
  END IF;

  -- obtener route y orden de la parada actual si existen
  SELECT route_id, orden INTO p_route, p_orden FROM paradas WHERE parada_id = NEW.parada_id LIMIT 1;

  -- buscar siguiente parada en la misma ruta (orden > current)
  IF p_route IS NOT NULL AND p_orden IS NOT NULL THEN
    SELECT parada_id INTO next_pid
      FROM paradas
     WHERE route_id = p_route AND orden > p_orden
     ORDER BY orden
     LIMIT 1;
  END IF;

  -- construir payload para NOTIFY (backend lo reenviará por socket)
  payload := jsonb_build_object(
    'telemetria', to_jsonb(NEW),
    'parada_id', NEW.parada_id,
    'bus_id', NEW.bus_id,
    'status', new_status::text,
    'route_id', p_route,
    'orden', p_orden,
    'next_parada_id', COALESCE(next_pid, NULL)
  );

  PERFORM pg_notify('telemetria_inserted', payload::text);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;



-- recrear trigger
DROP TRIGGER IF EXISTS trg_telemetria_after_insert ON telemetria;
CREATE TRIGGER trg_telemetria_after_insert
AFTER INSERT ON telemetria
FOR EACH ROW EXECUTE PROCEDURE fn_after_insert_telemetria_notify();

-- -------------------------
-- VISTAS ÚTILES PARA LA API
-- -------------------------
-- Vista de paradas con estado y coordenadas (para front)
CREATE OR REPLACE VIEW vw_paradas_realtime AS
SELECT
  p.parada_id,
  p.nombre,
  p.route_id,
  p.orden,
  p.coord_x,
  p.coord_y,
  p.realtime_status,
  p.current_bus_id,
  p.ultima_conexion_bus,
  p.ultima_actualizacion
FROM paradas p;

-- Vista de buses con estado y última parada conocida
CREATE OR REPLACE VIEW vw_buses_realtime AS
SELECT
  b.bus_id,
  b.activo,
  b.numero_pasajeros,
  b.capacidad_maxima,
  b.estado_bus,
  b.current_parada_id,
  b.last_seen_ts,
  b.rssi_bus,
  b.seq_bus,
  b.additional_info
FROM buses b;

-- -------------------------
-- EJEMPLOS: poblar route_id, orden, coord_x/coord_y (ajusta valores reales)
-- -------------------------
-- (Estos son ejemplos. En producción los harás con datos reales o CSV import.)
-- UPDATE manual ejemplo:
-- UPDATE paradas SET route_id = 'RUTA-1', orden = 1, coord_x = 0.15, coord_y = 0.22 WHERE parada_id = 'stop-01';

-- Insertar ejemplo de paradas (si no existen)
INSERT INTO paradas (parada_id, nombre, estado, coord_x, coord_y, route_id, orden, descripcion)
SELECT parada_id, nombre, estado::parada_state, coord_x, coord_y, route_id, orden, descripcion
FROM (VALUES
  ('stop-01','Parada A','activa',0.15,0.22,'RUTA-1',1,'Entrada principal'),
  ('stop-02','Parada B','activa',0.35,0.28,'RUTA-1',2,'Biblioteca'),
  ('stop-03','Parada C','activa',0.55,0.45,'RUTA-1',3,'Comedor'),
  ('stop-04','Parada D','activa',0.78,0.60,'RUTA-1',4,'Final')
) AS v(parada_id,nombre,estado,coord_x,coord_y,route_id,orden,descripcion)
WHERE NOT EXISTS (SELECT 1 FROM paradas p WHERE p.parada_id = v.parada_id);

-- Insertar ejemplo de buses (si no existen)
INSERT INTO buses (bus_id, activo, numero_pasajeros, estado_bus, capacidad_maxima)
SELECT bus_id, activo, numero_pasajeros, estado_bus::bus_state, capacidad_maxima
FROM (VALUES
  ('bus-1', true, 0, 'en_camino', 30),
  ('bus-2', true, 0, 'en_camino', 30)
) AS v(bus_id, activo, numero_pasajeros, estado_bus, capacidad_maxima)
WHERE NOT EXISTS (SELECT 1 FROM buses b WHERE b.bus_id = v.bus_id);

-- -------------------------
-- PERMISOS: ejemplo para api_user (ajusta usuario/contraseña fuera del script si ya creado)
-- -------------------------
-- CREATE USER api_user WITH ENCRYPTED PASSWORD 'api_pass';
--GRANT CONNECT ON DATABASE current_database() TO PUBLIC;
GRANT CONNECT ON DATABASE sistema_buses TO PUBLIC;
GRANT USAGE ON SCHEMA public TO PUBLIC;
-- Grant select on views/tables to api_user (si ya creado)
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO api_user;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO api_user;

-- -------------------------
-- NOTAS FINALES
-- -------------------------
-- 1) El trigger emite NOTIFY('telemetria_inserted', payload_text). El backend (Node) debe ejecutar:
--    client.query('LISTEN telemetria_inserted'); y en callback NOTIFY recibirá payload (text JSON).
--    El backend parsea JSON y reenvía por socket.io a los clientes móviles.
--
-- 2) Rellenar coord_x/coord_y y route_id/orden es crítico para la predicción y la animación A->B.
--    Puedes hacer esto manualmente con UPDATE o con una pequeña herramienta de admin (tocar la imagen).
--
-- 3) Las vistas vw_paradas_realtime y vw_buses_realtime permiten endpoints rápidos:
--    GET /paradas -> SELECT * FROM vw_paradas_realtime ORDER BY route_id, orden;
--    GET /buses -> SELECT * FROM vw_buses_realtime;
--
-- 4) Recomendación: crear una tabla `routes` si esperas múltiples rutas con metadata:
--    CREATE TABLE routes ( route_id TEXT PRIMARY KEY, nombre TEXT, descripcion TEXT, activo BOOLEAN DEFAULT TRUE );
--    Y luego foreign key route_id in paradas referencing routes(route_id).
--
-- 5) Haz backup antes de ejecutar.

