// server.js
import http from "http";
import dotenv from "dotenv";
import app from "./app.js";
import { initIo } from "./src/utils/io.js";
import { initPgListener } from "./src/utils/pg-listener.js";

dotenv.config();

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";

async function start() {
  const server = http.createServer(app);

  // Inicializa socket.io primero
  const io = await initIo(server);

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);
    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", socket.id, reason);
    });
  });

  // Inicializa el listener de Postgres (usa getIo internamente para emitir)
  try {
    await initPgListener();
  } catch (err) {
    console.error("No se pudo inicializar pg-listener:", err);
    // No abortamos; el server puede seguir sirviendo REST aunque el listener falle.
  }

  server.listen(PORT, HOST, () => {
    console.log(`🔥 API lista en http://${HOST}:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
