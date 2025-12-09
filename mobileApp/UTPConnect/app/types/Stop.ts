export type StopStatus = "idle" | "approaching" | "arrived";

export type Bus = { id: string; label: string; eta?: string };

export type Stop = {
  id: string;
  name: string;
  x: number; // 0..1
  y: number; // 0..1
  status: StopStatus;
  buses: Bus[];
};