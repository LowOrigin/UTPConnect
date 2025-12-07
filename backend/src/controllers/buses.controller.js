import { db } from "../config/db.js";

export async function getBuses(req, res) {
  try {
    const result = await db.query("SELECT bus_id, activo, numero_pasajeros, estado_bus, ultima_actualizacion, parada_actual_id, en_ruta FROM buses ORDER BY bus_id");
    res.json(result.rows);
  } catch (err) {
    console.error(err); res.status(500).json({ ok:false, error: err.message });
  }
}

export async function updateBus(req, res) {
  try {
    const { bus_id } = req.params;
    const { estado_bus, numero_pasajeros, parada_actual_id, en_ruta } = req.body;
    const q = `
      UPDATE buses SET
        estado_bus = COALESCE($1, estado_bus),
        numero_pasajeros = COALESCE($2, numero_pasajeros),
        parada_actual_id = COALESCE($3, parada_actual_id),
        en_ruta = COALESCE($4, en_ruta)
      WHERE bus_id = $5
      RETURNING *;
    `;
    const vals = [estado_bus, numero_pasajeros, parada_actual_id, en_ruta, bus_id];
    const result = await db.query(q, vals);
    res.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    console.error(err); res.status(500).json({ ok:false, error: err.message });
  }
}
