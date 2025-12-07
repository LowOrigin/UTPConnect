import { db } from "../config/db.js";

export async function insertarTelemetria(req, res) {
  try {
    const { bus_id, parada_id, evento, numero_pasajeros, ts, raw_payload } = req.body;

    // Usa ts enviado por gateway si viene, si no usa NOW()
    const timestamp = ts ? new Date(ts) : new Date();

    const query = `
      INSERT INTO telemetria (bus_id, parada_id, ts, evento, numero_pasajeros, raw_payload)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      bus_id,
      parada_id,
      timestamp,
      evento,
      numero_pasajeros ?? null,
      raw_payload ? JSON.stringify(raw_payload) : null
    ];

    const result = await db.query(query, values);

    return res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (err) {
    console.error("Error insertarTelemetria:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
