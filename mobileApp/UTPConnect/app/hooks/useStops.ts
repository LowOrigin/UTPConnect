// src/hooks/useStops.ts
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { io, Socket } from "socket.io-client";
import type { Stop, Bus } from "../types/Stop";
import { API_BASE, SOCKET_URL } from "../config/api";

const DEFAULT_COORD = { x: 0.5, y: 0.5 };

function mapParadaToStop(p: any): Stop {
  const bus: Bus[] = p.current_bus_id
    ? [{ id: p.current_bus_id, label: `Bus ${p.current_bus_id}`, eta: p.realtime_status === "arrived" ? "Ahora" : "≈ 2 min" }]
    : [];
  return {
    id: p.parada_id,
    name: p.nombre ?? p.parada_id,
    x: typeof p.coord_x === "number" ? p.coord_x : DEFAULT_COORD.x,
    y: typeof p.coord_y === "number" ? p.coord_y : DEFAULT_COORD.y,
    status: p.realtime_status ?? "idle",
    buses: bus,
  };
}

export default function useStops() {
  const [stops, setStops] = useState<Stop[]>([]);
  const socketRef = useRef<Socket | null>(null);

  // --- Limpiar y fetch inicial + polling ---
  useEffect(() => {
    let mounted = true;

    async function fetchStops() {
      try {
        const res = await axios.get(`${API_BASE}/paradas`);
        if (!mounted) return;
        const data = Array.isArray(res.data) ? res.data : res.data?.data ?? res.data;
        setStops((data ?? []).map(mapParadaToStop));
      } catch (e) {
        console.warn("useStops: fetch paradas error", e);
      }
    }

    setStops([]);
    fetchStops();
    const interval = setInterval(fetchStops, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // --- Conexión a Socket.io ---
  useEffect(() => {
    if (socketRef.current) return;

    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => console.log("Socket connected (mobile):", socket.id));
    socket.on("disconnect", (reason) => console.log("Socket disconnected (mobile):", reason));

    socket.on("telemetria_inserted", (payload: any) => {
      try {
        const t = payload?.telemetria ?? payload;
        if (!t) return;
        const paradaId = t.parada_id ?? t.paradaId ?? null;
        const busId = t.bus_id ?? t.busId ?? null;

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

            let newBuses = [...s.buses];

            if (statusFromPayload === "idle") {
              // ✅ Cuando la parada está idle, limpiar buses
              newBuses = [];
            } else if (busId) {
              const idx = newBuses.findIndex((b) => b.id === busId);
              const busLabel = t.bus_label ?? `Bus ${busId}`;
              const eta = statusFromPayload === "arrived" ? "Ahora" : "≈ 2 min";
              const newBusObj: Bus = { id: busId, label: busLabel, eta };
              if (idx >= 0) newBuses[idx] = newBusObj;
              else newBuses.unshift(newBusObj);
            }

            return { ...s, status: statusFromPayload as Stop["status"], buses: newBuses };
          });

          if (!updated.some((x) => x.id === paradaId) && paradaId) {
            updated = [
              {
                id: paradaId,
                name: paradaId,
                x: DEFAULT_COORD.x,
                y: DEFAULT_COORD.y,
                status: statusFromPayload as Stop["status"],
                buses: statusFromPayload === "idle" ? [] : busId ? [{ id: busId, label: `Bus ${busId}`, eta: "≈ 2 min" }] : [],
              },
              ...updated,
            ];
          }

          return updated;
        });
      } catch (err) {
        console.warn("socket telemetria_inserted handler error", err);
      }
    });

    socket.on("refresh_paradas", async () => {
      try {
        const res = await axios.get(`${API_BASE}/paradas`);
        const data = Array.isArray(res.data) ? res.data : res.data?.data ?? res.data;
        setStops((data ?? []).map(mapParadaToStop));
      } catch (err) {
        console.warn("socket refresh_paradas error", err);
      }
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      socketRef.current = null;
    };
  }, []);

  // --- Funciones disponibles ---
  function simulateBusToStop(stopId?: string) {
    const id = stopId ?? (stops.length ? stops[Math.floor(Math.random() * stops.length)].id : undefined);
    if (!id) return;

    setStops((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, status: "approaching", buses: [{ id: "sim-bus", label: "Bus Sim", eta: "2 min" }, ...s.buses] }
          : s
      )
    );

    setStops((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, status: "arrived", buses: [{ id: "sim-bus", label: "Bus Sim", eta: "Ahora" }, ...s.buses] }
          : s
      )
    );
  }

  function updateStops(newStops: Stop[]) {
    setStops(newStops);
  }

  return { stops, setStops: updateStops, simulateBusToStop, rawSocket: socketRef.current };
}
