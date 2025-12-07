// src/routes/paradas.routes.js
import express from "express";
import {
  getParadas,
  getParadaById,
  createParada,
  updateParada,
  deleteParada
} from "../controllers/paradas.controller.js";

const router = express.Router();

// GET /paradas      -> lista todas
router.get("/", getParadas);

// GET /paradas/:parada_id  -> obtener una por id
router.get("/:parada_id", getParadaById);

// POST /paradas     -> crear nueva parada
router.post("/", createParada);

// PUT /paradas/:parada_id  -> actualizar parada
router.put("/:parada_id", updateParada);

// DELETE /paradas/:parada_id -> eliminar parada
router.delete("/:parada_id", deleteParada);

export default router;
