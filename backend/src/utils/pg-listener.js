// src/utils/pg-listener.js
import { Client } from "pg";
import { getIo } from "./io.js"; // getIo() lanza si io no está inicializado
import dotenv from "dotenv";
dotenv.config();

let pgListenerClient = null;

export async function initPgListener() {
  if (pgListenerClient) return pgListenerClient;

  // Usa DATABASE_URL si está, si no crea cliente desde piezas
  const connString = process.env.DATABASE_URL;
  const client = connString
    ? new Client({ connectionString: connString })
    : new Client({
        host: process.env.PG_HOST || "localhost",
        port: process.env.PG_PORT ? parseInt(process.env.PG_PORT, 10) : 5432,
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        database: process.env.PG_DATABASE,
      });

  await client.connect();

  // Registrar LISTEN para el canal que usas en el trigger
  await client.query("LISTEN telemetria_inserted");

  client.on("notification", (msg) => {
    try {
      // msg.channel = 'telemetria_inserted', msg.payload = text JSON
      console.log("NOTIFY recibido:", msg.channel);

      // payload textual -> intentamos parsearlo a JSON
      let payload = null;
      try {
        payload = JSON.parse(msg.payload);
      } catch (e) {
        // no JSON: dejar como texto
        payload = msg.payload;
      }

      // Logueo detallado para debugging (aquí está tu console.log)
      console.log("NOTIFY payload:", typeof payload === "string" ? payload : JSON.stringify(payload));

      // Intentar emitir por Socket.IO si existe
      try {
        const io = getIo(); // si io no inicializado, getIo() lanza
        if (io && typeof io.emit === "function") {
          io.emit("telemetria_inserted", payload);
          console.log("Emitido por Socket.IO: telemetria_inserted");
        }
      } catch (err) {
        // no hay io o fallo al emitir -> sólo warn para no romper listener
        console.warn("Socket.IO no disponible para emitir (ok en dev):", err.message);
      }
    } catch (err) {
      // proteger listener para que no muera
      console.error("Error manejando notification:", err);
    }
  });

  client.on("error", (err) => {
    console.error("pg-listener error:", err);
  });

  pgListenerClient = client;
  console.log("pg-listener inicializado y escuchando telemetria_inserted");
  return pgListenerClient;
}

export async function closePgListener() {
  if (!pgListenerClient) return;
  try {
    await pgListenerClient.end();
  } catch (e) {
    console.warn("Error al cerrar pg-listener:", e.message);
  } finally {
    pgListenerClient = null;
  }
}
