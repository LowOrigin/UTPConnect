// src/utils/io.js
import { Server } from "socket.io";

let ioInstance = null;

/**
 * initIo(server, opts)
 * - server: instancia http.Server
 * - opts: opcional, opciones pasadas a new Server(...)
 *
 * Retorna la instancia de io (Server).
 * Si ya fue inicializado, devuelve la instancia existente.
 */
export async function initIo(server, opts = {}) {
  if (ioInstance) return ioInstance;

  // configuración por defecto compatible con desarrollo LAN
  const defaultOpts = {
    cors: {
      origin: opts.cors?.origin ?? "*",
      methods: ["GET", "POST"],
    },
    // ...puedes añadir path/namespaces si lo necesitas
  };

  ioInstance = new Server(server, { ...defaultOpts, ...opts });
  return ioInstance;
}

/**
 * getIo()
 * Devuelve la instancia ya inicializada, o lanza si no fue inicializada.
 */
export function getIo() {
  if (!ioInstance) throw new Error("io no inicializado. Llama a initIo(server) primero.");
  return ioInstance;
}

// Exportar default como getIo (compatibilidad con varias importaciones)
export default getIo;
