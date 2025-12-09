// app.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { db } from "./src/config/db.js";

// Importar rutas
import telemetriaRouter from "./src/routes/telemetria.routes.js";
import busesRouter from "./src/routes/buses.routes.js";
import paradasRouter from "./src/routes/paradas.routes.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Ruta simple de prueba
app.get("/", (req, res) => {
  res.send("API del sistema de buses funcionando 🚍");
});

// Probar conexión a la BD
app.get("/test-db", async (req, res) => {
  try {
    const result = await db.query("SELECT NOW()");
    res.json({ ok: true, time: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Usar rutas modulares
app.use("/telemetria", telemetriaRouter);
app.use("/buses", busesRouter);
app.use("/paradas", paradasRouter);

// Exporta la app para que server.js la use
export default app;
