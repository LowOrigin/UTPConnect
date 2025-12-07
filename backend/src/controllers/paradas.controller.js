// src/controllers/paradas.controller.js
import { db } from "../config/db.js";

/**
 * GET /paradas
 * Lista todas las paradas (ordenadas por 'orden' si existe).
 */
export async function getParadas(req, res) {
  try {
    const q = `
      SELECT parada_id, nombre, estado, ultima_conexion_bus, ultima_actualizacion,
             descripcion, created_at, orden
      FROM paradas
      ORDER BY orden NULLS LAST, nombre;
    `;
    const result = await db.query(q);
    return res.json(result.rows);
  } catch (err) {
    console.error("getParadas error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * GET /paradas/:parada_id
 * Devuelve una parada por su parada_id.
 */
export async function getParadaById(req, res) {
  try {
    const { parada_id } = req.params;
    const q = `
      SELECT parada_id, nombre, estado, ultima_conexion_bus, ultima_actualizacion,
             descripcion, created_at, orden
      FROM paradas
      WHERE parada_id = $1
      LIMIT 1;
    `;
    const result = await db.query(q, [parada_id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "Parada no encontrada" });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error("getParadaById error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /paradas
 * Crear una nueva parada.
 * Body: { parada_id, nombre, estado?, descripcion?, orden? }
 */
export async function createParada(req, res) {
  try {
    const { parada_id, nombre, estado = "activa", descripcion = null, orden = null } = req.body;

    if (!parada_id || !nombre) {
      return res.status(400).json({ ok: false, error: "parada_id y nombre son requeridos" });
    }

    const q = `
      INSERT INTO paradas (parada_id, nombre, estado, descripcion, orden)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING parada_id, nombre, estado, ultima_conexion_bus, ultima_actualizacion, descripcion, created_at, orden;
    `;

    const values = [parada_id, nombre, estado, descripcion, orden];
    const result = await db.query(q, values);
    return res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (err) {
    console.error("createParada error:", err);
    // Detectar violación de unique (parada_id ya existe)
    if (err.code === "23505") {
      return res.status(409).json({ ok: false, error: "parada_id ya existe" });
    }
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * PUT /paradas/:parada_id
 * Actualiza campos de una parada existente. Se usan COALESCE para no sobreescribir nulls.
 * Body: { nombre?, estado?, descripcion?, orden? }
 */
export async function updateParada(req, res) {
  try {
    const { parada_id } = req.params;
    const { nombre = null, estado = null, descripcion = null, orden = null } = req.body;

    const q = `
      UPDATE paradas
      SET
        nombre = COALESCE($1, nombre),
        estado = COALESCE($2, estado),
        descripcion = COALESCE($3, descripcion),
        orden = COALESCE($4, orden),
        ultima_actualizacion = now()
      WHERE parada_id = $5
      RETURNING parada_id, nombre, estado, ultima_conexion_bus, ultima_actualizacion, descripcion, created_at, orden;
    `;
    const vals = [nombre, estado, descripcion, orden, parada_id];
    const result = await db.query(q, vals);

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "Parada no encontrada" });
    }

    return res.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    console.error("updateParada error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * DELETE /paradas/:parada_id
 * Elimina una parada (cuidado: si hay FK puede fallar).
 */
export async function deleteParada(req, res) {
  try {
    const { parada_id } = req.params;

    const q = `
      DELETE FROM paradas
      WHERE parada_id = $1
      RETURNING parada_id;
    `;
    const result = await db.query(q, [parada_id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "Parada no encontrada" });
    }

    return res.json({ ok: true, message: "Parada eliminada", parada_id: result.rows[0].parada_id });
  } catch (err) {
    console.error("deleteParada error:", err);
    // Si falla por FK, devolver 409 conflict con mensaje claro
    if (err.code === "23503") {
      return res.status(409).json({ ok: false, error: "No se puede eliminar: hay registros dependientes" });
    }
    return res.status(500).json({ ok: false, error: err.message });
  }
}
