// test-client.js
import { io } from "socket.io-client";

const URL = process.env.SOCKET_URL || "http://localhost:3000";
const socket = io(URL, { transports: ["websocket"] });

socket.on("connect", () => {
  console.log("CONNECTED to socket.io with id=", socket.id);
});

socket.on("telemetria_inserted", (payload) => {
  console.log("EVENT telemetria_inserted received:", JSON.stringify(payload));
});

socket.on("disconnect", (reason) => {
  console.log("DISCONNECTED:", reason);
});

socket.on("connect_error", (err) => {
  console.error("connect_error:", err.message);
});
