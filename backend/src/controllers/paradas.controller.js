// src/controllers/paradas.controller.js
import { db } from "../config/db.js";

/**
 * GET /paradas
 * Lista todas las paradas (usa vw_paradas_realtime si existe).
 */
export async function getParadas(req, res) {
  try {
    const includeNext = (req.query.includeNext === "true");

    if (!includeNext) {
      const q = `
        SELECT parada_id, nombre, route_id, orden, coord_x, coord_y, realtime_status, current_bus_id,
               ultima_conexion_bus, ultima_actualizacion
        FROM vw_paradas_realtime
        ORDER BY route_id NULLS LAST, orden NULLS LAST, nombre;
      `;
      const result = await db.query(q);
      return res.status(200).json({ ok: true, data: result.rows });
    }

    // includeNext = true -> agregar next_parada por cada parada (subconsulta lateral)
    const q2 = `
      SELECT p.parada_id, p.nombre, p.route_id, p.orden, p.coord_x, p.coord_y,
             p.realtime_status, p.current_bus_id, p.ultima_conexion_bus, p.ultima_actualizacion,
             jsonb_build_object(
               'parada_id', np.parada_id,
               'coord_x', np.coord_x,
               'coord_y', np.coord_y,
               'orden', np.orden
             ) AS next_parada
      FROM paradas p
      LEFT JOIN LATERAL (
        SELECT parada_id, coord_x, coord_y, orden
        FROM paradas p2
        WHERE p2.route_id = p.route_id AND p2.orden = p.orden + 1
        ORDER BY p2.orden
        LIMIT 1
      ) np ON true
      ORDER BY p.route_id NULLS LAST, p.orden NULLS LAST, p.nombre;
    `;
    const result2 = await db.query(q2);
    return res.status(200).json({ ok: true, data: result2.rows });
  } catch (err) {
    console.error("getParadas error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}


/**
 * GET /paradas/:parada_id
 * Devuelve una parada por su parada_id + next_parada (si existe).
 */
export async function getParadaById(req, res) {
  try {
    const { parada_id } = req.params;

    const q = `
      SELECT p.parada_id, p.nombre, p.route_id, p.orden, p.coord_x, p.coord_y,
             p.realtime_status, p.current_bus_id, p.ultima_conexion_bus, p.ultima_actualizacion,
             -- next_parada embebida
             (SELECT jsonb_build_object('parada_id', p2.parada_id, 'coord_x', p2.coord_x, 'coord_y', p2.coord_y, 'orden', p2.orden)
              FROM paradas p2
              WHERE p2.route_id = p.route_id AND p2.orden = p.orden + 1
              LIMIT 1) AS next_parada
      FROM paradas p
      WHERE p.parada_id = $1
      LIMIT 1;
    `;
    const result = await db.query(q, [parada_id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "Parada no encontrada" });
    }

    return res.status(200).json({ ok: true, data: result.rows[0] });
  } catch (err) {
    console.error("getParadaById error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /paradas
 * Crear una nueva parada.
 * Body posible: { parada_id, nombre, estado?, descripcion?, orden?, route_id?, coord_x?, coord_y? }
 */
export async function createParada(req, res) {
  try {
    const {
      parada_id,
      nombre,
      estado = "activa",
      descripcion = null,
      orden = null,
      route_id = null,
      coord_x = null,
      coord_y = null
    } = req.body;

    if (!parada_id || !nombre) {
      return res.status(400).json({ ok: false, error: "parada_id y nombre son requeridos" });
    }

    // Validar coords si vienen
    if (coord_x !== null && (isNaN(coord_x) || coord_x < 0 || coord_x > 1)) {
      return res.status(400).json({ ok: false, error: "coord_x debe ser número entre 0 y 1" });
    }
    if (coord_y !== null && (isNaN(coord_y) || coord_y < 0 || coord_y > 1)) {
      return res.status(400).json({ ok: false, error: "coord_y debe ser número entre 0 y 1" });
    }

    const q = `
      INSERT INTO paradas (parada_id, nombre, estado, descripcion, orden, route_id, coord_x, coord_y)
      VALUES ($1, $2, $3::parada_state, $4, $5, $6, $7, $8)
      RETURNING parada_id, nombre, estado, route_id, orden, coord_x, coord_y, ultima_conexion_bus, ultima_actualizacion, created_at;
    `;

    const vals = [parada_id, nombre, estado, descripcion, orden, route_id, coord_x, coord_y];
    const result = await db.query(q, vals);
    return res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (err) {
    console.error("createParada error:", err);
    // unique violation (parada_id)
    if (err.code === "23505") {
      return res.status(409).json({ ok: false, error: "parada_id ya existe" });
    }
    // enum cast invalid (estado no válido)
    if (err.code === "22P02" || (err.message && err.message.includes("invalid input value for enum"))) {
      return res.status(400).json({ ok: false, error: "Valor inválido para campo 'estado'" });
    }
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * PUT /paradas/:parada_id
 * Actualiza campos de una parada existente.
 * Body aceptado: { nombre?, estado?, descripcion?, orden?, route_id?, coord_x?, coord_y? }
 */
export async function updateParada(req, res) {
  try {
    const { parada_id } = req.params;
    const { nombre, estado, descripcion, orden, route_id, coord_x, coord_y } = req.body;

    if (coord_x !== undefined && (coord_x !== null && (isNaN(coord_x) || coord_x < 0 || coord_x > 1))) {
      return res.status(400).json({ ok: false, error: "coord_x debe ser número entre 0 y 1" });
    }
    if (coord_y !== undefined && (coord_y !== null && (isNaN(coord_y) || coord_y < 0 || coord_y > 1))) {
      return res.status(400).json({ ok: false, error: "coord_y debe ser número entre 0 y 1" });
    }

    const updates = [];
    const values = [];
    let idx = 1;

    if (nombre !== undefined) {
      updates.push(`nombre = $${idx}`); values.push(nombre); idx++;
    }
    if (estado !== undefined) {
      updates.push(`estado = $${idx}::parada_state`); values.push(estado); idx++;
    }
    if (descripcion !== undefined) {
      updates.push(`descripcion = $${idx}`); values.push(descripcion); idx++;
    }
    if (orden !== undefined) {
      updates.push(`orden = $${idx}`); values.push(orden); idx++;
    }
    if (route_id !== undefined) {
      updates.push(`route_id = $${idx}`); values.push(route_id); idx++;
    }
    if (coord_x !== undefined) {
      updates.push(`coord_x = $${idx}`); values.push(coord_x); idx++;
    }
    if (coord_y !== undefined) {
      updates.push(`coord_y = $${idx}`); values.push(coord_y); idx++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ ok: false, error: "No hay campos a actualizar" });
    }

    updates.push(`ultima_actualizacion = now()`);

    const sql = `
      UPDATE paradas
      SET ${updates.join(", ")}
      WHERE parada_id = $${idx}
      RETURNING parada_id, nombre, estado, route_id, orden, coord_x, coord_y, ultima_conexion_bus, ultima_actualizacion, created_at;
    `;
    values.push(parada_id);

    const result = await db.query(sql, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "Parada no encontrada" });
    }

    return res.status(200).json({ ok: true, data: result.rows[0] });
  } catch (err) {
    console.error("updateParada error:", err);
    if (err.code === "22P02" || (err.message && err.message.includes("invalid input value for enum"))) {
      return res.status(400).json({ ok: false, error: "Valor inválido para campo 'estado'" });
    }
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * DELETE /paradas/:parada_id
 */
export async function deleteParada(req, res) {
  try {
    const { parada_id } = req.params;
    const q = `DELETE FROM paradas WHERE parada_id = $1 RETURNING parada_id;`;
    const result = await db.query(q, [parada_id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "Parada no encontrada" });
    }

    return res.status(200).json({ ok: true, message: "Parada eliminada", parada_id: result.rows[0].parada_id });
  } catch (err) {
    console.error("deleteParada error:", err);
    if (err.code === "23503") {
      return res.status(409).json({ ok: false, error: "No se puede eliminar: hay registros dependientes" });
    }
    return res.status(500).json({ ok: false, error: err.message });
  }
}
