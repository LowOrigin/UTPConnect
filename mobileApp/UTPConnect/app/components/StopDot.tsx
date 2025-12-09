import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import type { Stop } from "../types/Stop";

type Props = {
  stop: Stop;
  mapWidth: number;
  mapHeight: number;
  onPress?: (id: string) => void;
};

export default function StopDot({ stop, mapWidth, mapHeight, onPress }: Props) {
  const DOT_SIZE = 20;
  const left = stop.x * mapWidth - DOT_SIZE / 2;
  const top = stop.y * mapHeight - DOT_SIZE / 2;
  const color = stop.status === "arrived" ? "#2ecc71" : stop.status === "approaching" ? "#f1c40f" : "#bdbdbd";

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress?.(stop.id)}
      style={[styles.dot, { left, top, backgroundColor: color, width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 }]}
      accessibilityLabel={`Parada ${stop.name}`}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#fff",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
});