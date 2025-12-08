import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  ImageBackground,
  Button,
  FlatList,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Asset } from "expo-asset";

import useStops from "../hooks/useStops";
import StopDot from "../components/StopDot";
import type { Stop } from "../types/Stop";

const LOCAL_IMAGE = require("../../assets/images/Mapa.png");

const IMG_REAL_W = 1536;
const IMG_REAL_H = 1024;

const SCREEN_W = Dimensions.get("window").width;
const H_MARGIN = 32;
const MAP_MAX = 420;
const MAP_BOX_WIDTH = Math.min(SCREEN_W - H_MARGIN, MAP_MAX);
const MAP_BOX_HEIGHT = Math.round(MAP_BOX_WIDTH * (IMG_REAL_H / IMG_REAL_W));

export default function Mapa() {
  const { stops, simulateBusToStop } = useStops();
  const [selected, setSelected] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const asset = Asset.fromModule(LOCAL_IMAGE);
        await asset.downloadAsync();
        if (mounted) setImageLoaded(true);
      } catch {
        if (mounted) setImageLoaded(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const selectedStop: Stop | null = stops.find((s: Stop) => s.id === selected) ?? null;

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mapa de paradas</Text>
      </View>

      <View style={styles.container}>
        {/* Sección superior: Mapa (40%) */}
        <View style={styles.mapSection}>
          {!imageLoaded && <ActivityIndicator size="large" />}
          {imageLoaded && (
            <View style={[styles.mapContainer, { width: MAP_BOX_WIDTH, height: MAP_BOX_HEIGHT }]}>
              <ImageBackground
                source={LOCAL_IMAGE}
                style={{ width: MAP_BOX_WIDTH, height: MAP_BOX_HEIGHT }}
                imageStyle={{ resizeMode: "contain" }}
              >
                {stops.map((s: Stop) => (
                  <StopDot
                    key={s.id}
                    stop={s}
                    mapWidth={MAP_BOX_WIDTH}
                    mapHeight={MAP_BOX_HEIGHT}
                    onPress={setSelected}
                  />
                ))}
              </ImageBackground>
            </View>
          )}
        </View>

        {/* Sección inferior: Información de parada seleccionada (60%) con scroll */}
        <View style={styles.infoSection}>
          {selectedStop ? (
            <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={true}>
              {/* Nombre de parada */}
              <View style={styles.infoHeader}>
                <Text style={styles.infoTitle}>{selectedStop.name}</Text>
                <TouchableOpacity onPress={() => setSelected(null)}>
                  <Text style={styles.closeBtn}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Horario */}
              <Text style={styles.label}>Horario:</Text>
              <Text style={styles.infoText}>08:00 · 09:30 · 11:00</Text>

              {/* Estado */}
              <Text style={styles.label}>Estado:</Text>
              <Text style={styles.statusText}>
                {selectedStop.status === "arrived"
                  ? "🟢 Bus llegado"
                  : selectedStop.status === "approaching"
                  ? "🟡 Bus en camino"
                  : "⚫ Sin buses"}
              </Text>

              {/* Buses (scrollable dentro del ScrollView) */}
              <Text style={styles.label}>Buses:</Text>
              {selectedStop.buses.length === 0 ? (
                <Text style={styles.infoText}>No hay buses para esta parada.</Text>
              ) : (
                <View style={styles.busList}>
                  {selectedStop.buses.map((bus) => (
                    <View key={bus.id} style={styles.busItem}>
                      <View style={styles.busLeft}>
                        <Text style={styles.busLabel}>{bus.label}</Text>
                        <Text style={styles.busEta}>{bus.eta ?? "-"}</Text>
                      </View>
                      <View style={styles.busCapacity}>
                        <Text style={styles.capacityText}>Capacidad: 3/20</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Botón de simulación */}
              <View style={styles.actionButtons}>
                <Button
                  title="Simular llegada"
                  onPress={() => simulateBusToStop(selectedStop.id)}
                />
              </View>
            </ScrollView>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Selecciona una parada para ver detalles</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    height: 56,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111",
  },
  container: {
    flex: 1,
    flexDirection: "column",
  },
  mapSection: {
    flex: 0.4,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  mapContainer: {
    backgroundColor: "#fff",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#f2f2f2",
  },
  infoSection: {
    flex: 0.6,
    backgroundColor: "#f9f9f9",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scrollContent: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
  },
  infoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
    flex: 1,
  },
  closeBtn: {
    fontSize: 20,
    color: "#999",
    paddingHorizontal: 8,
  },
  label: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
  },
  statusText: {
    fontSize: 13,
    color: "#333",
    marginTop: 4,
    fontWeight: "500",
  },
  infoText: {
    fontSize: 13,
    color: "#333",
    marginTop: 4,
  },
  busList: {
    marginTop: 8,
  },
  busItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 6,
    backgroundColor: "#fff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#eee",
  },
  busLeft: {
    flex: 1,
  },
  busLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111",
  },
  busEta: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  busCapacity: {
    marginLeft: 8,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: "#eee",
  },
  capacityText: {
    fontSize: 12,
    color: "#333",
    fontWeight: "500",
  },
  actionButtons: {
    marginTop: 16,
    marginBottom: 12,
  },
});