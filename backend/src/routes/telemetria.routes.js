import express from "express";
import { insertarTelemetria } from "../controllers/telemetria.controller.js";

const router = express.Router();

// POST /telemetria
router.post("/", insertarTelemetria);

// opcional: obtener historial
router.get("/", async (req, res) => {
  // add pagination later
  const { db } = await import("../config/db.js");
  const q = await db.query("SELECT * FROM telemetria ORDER BY ts DESC LIMIT 100");
  res.json(q.rows);
});

export default router;
