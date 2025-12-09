// server.js
import http from "http";
import dotenv from "dotenv";
import app from "./app.js";
import { initIo, getIo } from "./src/utils/io.js";

dotenv.config();

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";

async function start() {
  // crea servidor HTTP con express app
  const server = http.createServer(app);

  // inicializa socket.io (devuelve instancia)
  // initIo puede ser async (por si necesita imports dinámicos)
  const io = await initIo(server);

  // ejemplo: loguear conexiones
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", socket.id, reason);
    });
  });

  server.listen(PORT, HOST, () => {
    console.log(`🔥 API lista en http://${HOST}:${PORT}`);
  });
}

start().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
