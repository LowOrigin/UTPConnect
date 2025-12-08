import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{
        headerTitle: "UTP Connect (index.tsx)"
      }} />
      <Stack.Screen name="Pantallas/Mapa" options={{
        headerTitle: "Mapa de paradas (Pantalla/Mapa.tsx)"
      }} />
    </Stack>
  
);
}