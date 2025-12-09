// src/hooks/useStops.ts
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { io, Socket } from "socket.io-client";
import type { Stop, Bus } from "../types/Stop";
import { API_BASE, SOCKET_URL } from "../config/api";

// tiempo (ms) tras el cual se limpia un estado 'arrived'/'approaching' y vuelve a 'idle'
const CLEAR_STATUS_MS = 20_000;

const DEFAULT_COORD = { x: 0.5, y: 0.5 };

function mapParadaToStop(p: any): Stop {
  // p viene de la API: parada_id, nombre, coord_x, coord_y, realtime_status, current_bus_id, ...
  return {
    id: p.parada_id,
    name: p.nombre ?? p.parada_id,
    x: typeof p.coord_x === "number" ? p.coord_x : DEFAULT_COORD.x,
    y: typeof p.coord_y === "number" ? p.coord_y : DEFAULT_COORD.y,
    status: (p.realtime_status ?? "idle") as Stop["status"],
    buses: [] as Bus[],
  };
}

export default function useStops() {
  const [stops, setStops] = useState<Stop[]>([]);
  const socketRef = useRef<Socket | null>(null);

  // Usamos ReturnType<typeof setTimeout> para ser portable entre DOM/Node
  const clearTimers = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({});

  // fetch inicial de paradas desde API
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await axios.get(`${API_BASE}/paradas`); // GET /paradas
        if (!mounted) return;
        // res.data puede ser { ok:true, data: [...] } o un array dependiendo de tu endpoint
        const data = Array.isArray(res.data) ? res.data : res.data?.data ?? res.data;
        const mapped: Stop[] = (data ?? []).map(mapParadaToStop);
        setStops(mapped);
      } catch (e) {
        console.warn("useStops: fetch paradas error", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // conectar socket.io y escuchar telemetria_inserted
  useEffect(() => {
    // evitar reconectar si ya hay instancia
    if (socketRef.current) return;

    // conectar (asegúrate SOCKET_URL correcto en config)
    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected (mobile):", socket.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected (mobile):", reason);
    });

    // payload esperado: { telemetria: {...}, bus: {...}, parada: {...}, source: "api", status: "arrived" }
    socket.on("telemetria_inserted", (payload: any) => {
      try {
        const t = payload?.telemetria ?? payload;
        if (!t) return;
        const paradaId = t.parada_id ?? t.paradaId ?? null;
        const busId = t.bus_id ?? t.busId ?? null;
        // status viene de payload.status (trigger) o deducimos desde evento
        const statusFromPayload =
          payload?.status ??
          (t.evento && /llego|arriv/i.test(t.evento)
            ? "arrived"
            : t.evento && /detect|detectado|aproxim|camino/i.test(t.evento)
            ? "approaching"
            : "idle");

        setStops((prev) => {
          let updated = prev.map((s) => {
            if (s.id !== paradaId) return s;
            // actualizamos estado y lista de buses
            const newBuses = [...s.buses];

            if (busId) {
              // intenta actualizar bus existente o añadir uno nuevo breve
              const idx = newBuses.findIndex((b) => b.id === busId);
              const busLabel = t.bus_label ?? `Bus ${busId}`;
              const eta = statusFromPayload === "arrived" ? "Ahora" : "≈ 2 min";

              const newBusObj: Bus = { id: busId, label: busLabel, eta };
              if (idx >= 0) newBuses[idx] = newBusObj;
              else newBuses.unshift(newBusObj); // añadir arriba
            }

            return {
              ...s,
              status: statusFromPayload as Stop["status"],
              buses: newBuses,
            };
          });

          // si no encontramos la parada en lista, opcionalmente podemos fetchear la parada puntual
          const found = updated.some((x) => x.id === paradaId);
          if (!found && paradaId) {
            // agregar parada mínima temporal para no romper UI (coordenadas por defecto)
            updated = [
              {
                id: paradaId,
                name: paradaId,
                x: DEFAULT_COORD.x,
                y: DEFAULT_COORD.y,
                status: statusFromPayload as Stop["status"],
                buses: busId ? [{ id: busId, label: `Bus ${busId}`, eta: "Ahora" }] : [],
              },
              ...updated,
            ];
          }

          return updated;
        });

        // limpiar timers previos y programar volver a idle
        if (paradaId) {
          if (clearTimers.current[paradaId]) {
            clearTimeout(clearTimers.current[paradaId] as unknown as number);
          }
          clearTimers.current[paradaId] = setTimeout(() => {
            setStops((prev) =>
              prev.map((s) => (s.id === paradaId ? { ...s, status: "idle", buses: [] } : s))
            );
            delete clearTimers.current[paradaId];
          }, CLEAR_STATUS_MS);
        }
      } catch (err) {
        console.warn("socket telemetria_inserted handler error", err);
      }
    });

    return () => {
      // cleanup
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      // clear timers
      Object.values(clearTimers.current).forEach((t) => {
        if (t) clearTimeout(t as unknown as number);
      });
      clearTimers.current = {};
    };
  }, []);

  // funciones disponibles al componente
  function simulateBusToStop(stopId?: string) {
    // mantener compatibilidad con tu UI: disparar simulación local
    const id = stopId ?? (stops.length ? stops[Math.floor(Math.random() * stops.length)].id : undefined);
    if (!id) return;
    setStops((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: "approaching", buses: [{ id: "sim-bus", label: "Bus Sim", eta: "2 min" }] } : s
      )
    );
    setTimeout(() => {
      setStops((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: "arrived", buses: [{ id: "sim-bus", label: "Bus Sim", eta: "Ahora" }] } : s))
      );
      setTimeout(() => {
        setStops((prev) => prev.map((s) => (s.id === id ? { ...s, status: "idle", buses: [] } : s)));
      }, 6000);
    }, 4000);
  }

  function updateStops(newStops: Stop[]) {
    setStops(newStops);
  }

  return { stops, setStops: updateStops, simulateBusToStop, rawSocket: socketRef.current };
}
