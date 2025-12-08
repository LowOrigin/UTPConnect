import { useState } from "react";
import type { Stop, Bus } from "../types/Stop";

const INITIAL_STOPS: Stop[] = [
  { id: "p1", name: "Parada A", x: 0.366, y: 0.830, status: "idle", buses: [] },
  { id: "p2", name: "Parada B", x: 0.474, y: 0.672, status: "idle", buses: [] },
  { id: "p3", name: "Parada C", x: 0.484, y: 0.465, status: "idle", buses: [] },
];

export default function useStops() {
  const [stops, setStops] = useState<Stop[]>(INITIAL_STOPS);

  function simulateBusToStop(stopId?: string) {
    const id = stopId ?? stops[Math.floor(Math.random() * stops.length)].id;
    setStops((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, status: "approaching", buses: [{ id: "bus1", label: "Bus 1", eta: "2 min" }] }
          : s
      )
    );
    setTimeout(() => {
      setStops((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, status: "arrived", buses: [{ id: "bus1", label: "Bus 1", eta: "Ahora" }] } : s
        )
      );
      setTimeout(() => {
        setStops((prev) => prev.map((s) => (s.id === id ? { ...s, status: "idle", buses: [] } : s)));
      }, 6000);
    }, 4000);
  }

  function updateStops(newStops: Stop[]) {
    setStops(newStops);
  }

  return { stops, setStops: updateStops, simulateBusToStop };
}