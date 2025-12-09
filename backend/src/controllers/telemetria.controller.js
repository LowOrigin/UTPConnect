// src/controllers/telemetria.controller.js
import { db } from "../config/db.js";

/**
 * POST /telemetria
 * Body expected:
 * {
 *   bus_id: "bus-1",
 *   parada_id: "stop-02",
 *   evento: "bus_detectado" | "bus_llego" | ...,
 *   numero_pasajeros: 3,            // opcional
 *   ts: "2025-12-08T12:00:00Z",     // opcional (si no, se usa now())
 *   raw_payload: {...}              // opcional (objeto o string)
 *   rssi: -65,                      // opcional (entero)
 *   route_id: "RUTA-1",             // opcional
 *   orden: 2                        // opcional (entero)
 * }
 *
 * Response: { ok: true, data: { telemetria, bus?, parada? } }
 *
 * NOTE: This controller will try to dynamically import ../utils/io.js and call io.emit('telemetria_inserted', payload)
 * If you plan to use pg_notify + LISTEN in production, remove/disable the emit here to avoid duplicated events.
 */
export async function insertarTelemetria(req, res) {
  try {
    const {
      bus_id,
      parada_id,
      evento,
      numero_pasajeros,
      ts,
      raw_payload,
      rssi = null,
      route_id = null,
      orden = null
    } = req.body;

    // validaciones básicas
    if (!bus_id || !parada_id || !evento) {
      return res.status(400).json({ ok: false, error: "bus_id, parada_id y evento son requeridos" });
    }

    // validar existencia de bus y parada (evita FK error confuso)
    const chkBus = await db.query("SELECT 1 FROM buses WHERE bus_id = $1", [bus_id]);
    if (chkBus.rowCount === 0) {
      return res.status(400).json({ ok: false, error: `bus_id '${bus_id}' no existe` });
    }

    const chkParada = await db.query("SELECT 1 FROM paradas WHERE parada_id = $1", [parada_id]);
    if (chkParada.rowCount === 0) {
      return res.status(400).json({ ok: false, error: `parada_id '${parada_id}' no existe` });
    }

    // preparar timestamp
    let timestamp;
    if (ts) {
      const d = new Date(ts);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ ok: false, error: "ts inválido" });
      }
      timestamp = d.toISOString();
    } else {
      timestamp = new Date().toISOString();
    }

    // normalizar raw_payload a JSONB (si viene)
    let rawPayloadJson = null;
    if (raw_payload !== undefined && raw_payload !== null) {
      if (typeof raw_payload === "object") {
        rawPayloadJson = raw_payload;
      } else {
        try {
          rawPayloadJson = JSON.parse(raw_payload);
        } catch {
          rawPayloadJson = { raw: String(raw_payload) };
        }
      }
    }

    // Insert ampliado (incluye rssi, route_id, orden)
    const insertQ = `
      INSERT INTO telemetria
        (bus_id, parada_id, ts, evento, numero_pasajeros, raw_payload, rssi, route_id, orden)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, bus_id, parada_id, ts, evento, numero_pasajeros, raw_payload, rssi, route_id, orden, created_at;
    `;
    const insertVals = [
      bus_id,
      parada_id,
      timestamp,
      evento,
      numero_pasajeros ?? null,
      rawPayloadJson ? JSON.stringify(rawPayloadJson) : null,
      (rssi !== undefined && rssi !== null) ? rssi : null,
      route_id ?? null,
      (orden !== undefined && orden !== null) ? orden : null
    ];

    const insertResult = await db.query(insertQ, insertVals);
    const telemetriaRow = insertResult.rows[0];

    // Obtener estado actualizado del bus y la parada desde las vistas (si existen)
    let busRow = null;
    let paradaRow = null;

    try {
      const r1 = await db.query("SELECT * FROM vw_buses_realtime WHERE bus_id = $1 LIMIT 1", [bus_id]);
      if (r1.rowCount > 0) busRow = r1.rows[0];
    } catch (e) {
      console.warn("vw_buses_realtime not available or query failed:", e.message);
    }

    try {
      const r2 = await db.query("SELECT * FROM vw_paradas_realtime WHERE parada_id = $1 LIMIT 1", [parada_id]);
      if (r2.rowCount > 0) paradaRow = r2.rows[0];
    } catch (e) {
      console.warn("vw_paradas_realtime not available or query failed:", e.message);
    }

    // ------------------------------------------------------------
    // EMIT por socket.io (rápido para desarrollo)
    // Intentamos importar dinámicamente un módulo utils/io.js que exporte el singleton io.
    // Si no existe, ignoramos silenciosamente la emisión (no rompe la API).
    // ------------------------------------------------------------
    try {
      // Intentamos importar el módulo (usa import dinámico para no forzar dependencia)
      const mod = await import("../utils/io.js"); // debe exportar default = io o named export getIo
      // Soportar varias exportaciones comunes:
      const io = mod.default ?? mod.getIo ?? mod.io ?? null;
      if (io && typeof io.emit === "function") {
        const payload = {
          telemetria: telemetriaRow,
          bus: busRow ?? null,
          parada: paradaRow ?? null,
          source: "api" // marca que vino vía la API
        };
        // Emite evento listo para que React/Expo lo escuche
        io.emit("telemetria_inserted", payload);
      } else {
        // si la importación devolvió una función init o algo distinto, intentar si existe getIo()
        if (mod && typeof mod.getIo === "function") {
          const io2 = mod.getIo();
          if (io2 && typeof io2.emit === "function") {
            io2.emit("telemetria_inserted", { telemetria: telemetriaRow, bus: busRow, parada: paradaRow, source: "api" });
          }
        }
      }
    } catch (e) {
      // No hay módulo io o falló, no es crítico en desarrollo -> seguir
      // console.warn para que sepas si no está disponible
      console.warn("Socket.io emit skipped (utils/io.js not available or failed):", e.message);
    }

    // devolver telemetría creada y estado actual (bus, parada)
    return res.status(201).json({
      ok: true,
      data: {
        telemetria: telemetriaRow,
        bus: busRow,
        parada: paradaRow
      }
    });
  } catch (err) {
    console.error("insertarTelemetria error:", err);

    if (err.code === "23503") {
      return res.status(400).json({ ok: false, error: "FK violation: bus_id o parada_id no válidos" });
    }

    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * GET /telemetria
 * Opciones: ?limit=100&offset=0&bus_id=bus-1&parada_id=stop-1
 * Devuelve histórico (paginado).
 */
export async function getTelemetriaHistorial(req, res) {
  try {
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit || "100", 10)));
    const offset = Math.max(0, parseInt(req.query.offset || "0", 10));
    const { bus_id, parada_id } = req.query;

    const where = [];
    const vals = [];
    let idx = 1;
    if (bus_id) {
      where.push(`bus_id = $${idx}`); vals.push(bus_id); idx++;
    }
    if (parada_id) {
      where.push(`parada_id = $${idx}`); vals.push(parada_id); idx++;
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const q = `
      SELECT id, bus_id, parada_id, ts, evento, numero_pasajeros, raw_payload, rssi, route_id, orden, created_at
      FROM telemetria
      ${whereClause}
      ORDER BY ts DESC, id DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    vals.push(limit, offset);

    const result = await db.query(q, vals);
    return res.status(200).json({ ok: true, count: result.rowCount, data: result.rows });
  } catch (err) {
    console.error("getTelemetriaHistorial error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
