import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { db } from "./config/db.js";

// Importar rutas (siempre arriba)
import telemetriaRouter from "./routes/telemetria.routes.js";
import busesRouter from "./routes/buses.routes.js";
import paradasRouter from "./routes/paradas.routes.js";

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

const PORT = process.env.PORT || 3000;

// Usar rutas modulares
app.use("/telemetria", telemetriaRouter);
app.use("/buses", busesRouter);
app.use("/paradas", paradasRouter);

//app.listen(PORT, () =>
  //console.log(`🔥 API lista en http://localhost:${PORT}`)
//);

app.listen(PORT, '0.0.0.0', () =>
  console.log(`🔥 API lista en http://${process.env.HOST || '0.0.0.0'}:${PORT}`)
);
