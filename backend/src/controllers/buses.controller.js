// controllers/buses.controller.js
import { db } from "../config/db.js";

/**
 * GET /buses
 * Devuelve todos los buses (usa la vista vw_buses_realtime si existe)
 */
export async function getBuses(req, res) {
  try {
    // Usamos la vista vw_buses_realtime creada por la migración
    const q = `SELECT bus_id, activo, numero_pasajeros, capacidad_maxima, estado_bus,
                      current_parada_id AS current_parada_id, last_seen_ts, rssi_bus, seq_bus, additional_info
               FROM vw_buses_realtime
               ORDER BY bus_id`;
    const result = await db.query(q);
    return res.status(200).json({ ok: true, data: result.rows });
  } catch (err) {
    console.error("getBuses error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * PUT /buses/:bus_id
 * Actualiza campos selectos del bus.
 * Body aceptado: { estado_bus, numero_pasajeros, current_parada_id, capacidad_maxima, additional_info }
 */
export async function updateBus(req, res) {
  try {
    const { bus_id } = req.params;
    const {
      estado_bus,           // string compatible con enum bus_state (ej 'en_camino')
      numero_pasajeros,     // integer
      current_parada_id,    // string (parada_id)
      capacidad_maxima,     // integer
      additional_info       // object -> JSONB
    } = req.body;

    // Comprobación simple: existe el bus?
    const chk = await db.query("SELECT 1 FROM buses WHERE bus_id = $1", [bus_id]);
    if (chk.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "Bus no encontrado" });
    }

    // Si se proporciona current_parada_id, opcional validar que la parada exista:
    if (current_parada_id) {
      const chkP = await db.query("SELECT 1 FROM paradas WHERE parada_id = $1", [current_parada_id]);
      if (chkP.rowCount === 0) {
        return res.status(400).json({ ok: false, error: "parada_id no existe" });
      }
    }

    // Construimos UPDATE dinámico para no sobreescribir con NULL innecesario
    const updates = [];
    const values = [];
    let idx = 1;

    if (estado_bus !== undefined) {
      // casteamos a enum para mayor robustez; si es null/undefined no lo agregamos.
      updates.push(`estado_bus = $${idx}::bus_state`);
      values.push(estado_bus);
      idx++;
    }
    if (numero_pasajeros !== undefined) {
      updates.push(`numero_pasajeros = $${idx}`);
      values.push(numero_pasajeros);
      idx++;
    }
    if (current_parada_id !== undefined) {
      updates.push(`current_parada_id = $${idx}`);
      values.push(current_parada_id);
      idx++;
    }
    if (capacidad_maxima !== undefined) {
      updates.push(`capacidad_maxima = $${idx}`);
      values.push(capacidad_maxima);
      idx++;
    }
    if (additional_info !== undefined) {
      updates.push(`additional_info = $${idx}::jsonb`);
      values.push(JSON.stringify(additional_info));
      idx++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ ok: false, error: "No hay campos a actualizar" });
    }

    // siempre actualizamos last_seen_ts si número de pasajeros o parada cambia? opcional
    updates.push(`ultima_actualizacion = now()`);

    // construir query final
    const sql = `
      UPDATE buses
      SET ${updates.join(", ")}
      WHERE bus_id = $${idx}
      RETURNING bus_id, activo, numero_pasajeros, capacidad_maxima, estado_bus, current_parada_id, last_seen_ts, rssi_bus, seq_bus, additional_info;
    `;
    values.push(bus_id);

    const result = await db.query(sql, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "Bus no encontrado (race condition)" });
    }

    return res.status(200).json({ ok: true, data: result.rows[0] });
  } catch (err) {
    console.error("updateBus error:", err);
    // Si el error es cast a enum inválido, devolvemos 400
    if (err.code === "22P02" || err.message.includes("invalid input value for enum")) {
      return res.status(400).json({ ok: false, error: "Valor inválido para estado_bus" });
    }
    return res.status(500).json({ ok: false, error: err.message });
  }
}
