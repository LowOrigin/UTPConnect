// test-client.js
import { io } from "socket.io-client";

const SERVER = process.env.SERVER || "http://localhost:3000"; // ajustar si usas otra IP/puerto
const socket = io(SERVER, { transports: ["websocket"], reconnection: true });

socket.on("connect", () => {
  console.log("CONNECTED to socket.io with id=", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("DISCONNECTED:", reason);
});

socket.on("connect_error", (err) => {
  console.error("CONNECT_ERROR:", err.message);
});

// escucha el evento de telemetría
socket.on("telemetria_inserted", (payload) => {
  console.log("telemetria_inserted ->", JSON.stringify(payload, null, 2));
});

// opcional: cerrar después de 60s
setTimeout(() => {
  console.log("closing test client");
  socket.close();
  process.exit(0);
}, 60000);
