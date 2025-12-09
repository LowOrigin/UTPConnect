// src/routes/telemetria.routes.js
import express from "express";
import {
  insertarTelemetria,
  getTelemetriaHistorial
} from "../controllers/telemetria.controller.js";

const router = express.Router();

// POST /telemetria
router.post("/", insertarTelemetria);

// GET /telemetria?limit=100&offset=0
router.get("/", getTelemetriaHistorial);

export default router;
