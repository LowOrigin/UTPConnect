import React from 'react';
import { StyleSheet, View } from "react-native";
import MapView, { Marker } from 'react-native-maps';

export default function Mapa() {
  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider="google"
        initialRegion={{
          latitude: 9.0245,
          longitude: -79.531,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        <Marker
          coordinate={{
            latitude: 9.0245,
            longitude: -79.531,
          }}
          title="UTP"
          description="Universidad Tecnológica de Panamá"
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
});