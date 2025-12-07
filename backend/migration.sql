-- migration.sql (versión simplificada, sin lat/lng ni batería)

-- Limpieza segura (para poder re-ejecutar el script sin errores)
DROP TRIGGER IF EXISTS trg_telemetria_after_insert ON telemetria;
DROP FUNCTION IF EXISTS fn_after_insert_telemetria();
DROP TABLE IF EXISTS telemetria;
DROP TABLE IF EXISTS eventos;
DROP TABLE IF EXISTS buses;
DROP TABLE IF EXISTS paradas;
DROP TYPE IF EXISTS bus_state CASCADE;
DROP TYPE IF EXISTS parada_state CASCADE;

-- ===== Tipos ENUM =====
CREATE TYPE bus_state AS ENUM ('llego_parada','en_camino','detenido','fuera_de_servicio');
CREATE TYPE parada_state AS ENUM ('activa','sin_comunicacion','mantenimiento');

-- ===== TABLA: paradas (stops) =====
CREATE TABLE IF NOT EXISTS paradas (
  id BIGSERIAL PRIMARY KEY,
  parada_id TEXT UNIQUE NOT NULL,      -- ej 'stop-01'
  nombre TEXT NOT NULL,
  estado parada_state DEFAULT 'activa',
  ultima_conexion_bus TIMESTAMP WITH TIME ZONE, -- ultimo evento detectado de un bus
  ultima_actualizacion TIMESTAMP WITH TIME ZONE, -- ultimo mensaje del ESP32 de la parada
  descripcion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ===== TABLA: buses (dispositivo en el bus) =====
CREATE TABLE IF NOT EXISTS buses (
  id BIGSERIAL PRIMARY KEY,
  bus_id TEXT UNIQUE NOT NULL,         -- ej 'bus-01'
  activo BOOLEAN DEFAULT TRUE,
  numero_pasajeros INTEGER DEFAULT 0,
  estado_bus bus_state DEFAULT 'en_camino',
  ultima_actualizacion TIMESTAMP WITH TIME ZONE,
  rssi_bus INTEGER,
  seq_bus BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ===== TABLA: telemetria (histórico de detecciones) =====
CREATE TABLE IF NOT EXISTS telemetria (
  id BIGSERIAL PRIMARY KEY,
  bus_id TEXT NOT NULL REFERENCES buses(bus_id) ON DELETE CASCADE,
  parada_id TEXT NOT NULL REFERENCES paradas(parada_id) ON DELETE CASCADE,
  ts TIMESTAMP WITH TIME ZONE NOT NULL,    -- timestamp del evento (o timestamp del gateway)
  evento TEXT NOT NULL,                    -- 'bus_detectado', 'bus_llego', 'bus_se_fue', 'lectura_pasajeros'
  numero_pasajeros INTEGER,
  raw_payload JSONB,
  rssi INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ===== TABLA: eventos del sistema (opcional) =====
CREATE TABLE IF NOT EXISTS eventos (
  id BIGSERIAL PRIMARY KEY,
  dispositivo_id TEXT,      -- puede ser bus_id o parada_id
  tipo_evento TEXT NOT NULL,
  detalle JSONB,
  ts TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ===== INDICES =====
CREATE INDEX IF NOT EXISTS idx_paradas_parada_id ON paradas(parada_id);
CREATE INDEX IF NOT EXISTS idx_buses_bus_id ON buses(bus_id);
CREATE INDEX IF NOT EXISTS idx_telemetria_bus_ts ON telemetria(bus_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_telemetria_parada_ts ON telemetria(parada_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_ts ON eventos(ts DESC);

-- ===== FUNCION Y TRIGGER para actualizar ultima_actualizacion / ultima_conexion_bus =====
CREATE OR REPLACE FUNCTION fn_after_insert_telemetria()
RETURNS TRIGGER AS $$
DECLARE
  seq_val BIGINT;
BEGIN
  -- extrae seq del raw_payload si existe: raw_payload->>'seq'
  seq_val := NULL;
  IF NEW.raw_payload IS NOT NULL AND (NEW.raw_payload ? 'seq') THEN
    BEGIN
      seq_val := (NEW.raw_payload->>'seq')::BIGINT;
    EXCEPTION WHEN others THEN
      seq_val := NULL;
    END;
  END IF;

  -- Actualiza ultima_actualizacion en buses
  UPDATE buses
    SET ultima_actualizacion = NEW.ts,
        seq_bus = COALESCE(seq_val, seq_bus),
        numero_pasajeros = COALESCE(NEW.numero_pasajeros, numero_pasajeros),
        rssi_bus = COALESCE(NEW.rssi, rssi_bus)
    WHERE bus_id = NEW.bus_id;

  -- Actualiza ultima_conexion_bus y ultima_actualizacion en paradas
  UPDATE paradas
    SET ultima_conexion_bus = NEW.ts,
        ultima_actualizacion = NEW.ts
    WHERE parada_id = NEW.parada_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_telemetria_after_insert
AFTER INSERT ON telemetria
FOR EACH ROW
EXECUTE PROCEDURE fn_after_insert_telemetria();

-- ===== PERMISOS para api_user (ejemplo) =====
-- Ejecuta estas líneas como superuser si quieres crear el usuario y darle permisos:
-- CREATE USER api_user WITH ENCRYPTED PASSWORD 'api_pass';
-- GRANT CONNECT ON DATABASE sistema_buses TO api_user;
-- GRANT USAGE ON SCHEMA public TO api_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO api_user;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO api_user;
