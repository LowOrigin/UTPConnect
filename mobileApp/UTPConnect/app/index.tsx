import { Link } from "expo-router";
import { Image, StyleSheet, Text, View } from "react-native";

export default function Index() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image 
          source={require('../assets/images/logobusmorado.png')}
          style={styles.logo}
        />
        <Text style={styles.title}>UTP Connect</Text>
        <Text style={styles.subtitle}>Tu app de paradas de autobús</Text>
        
        <Link href="/Pantallas/Mapa" style={styles.button}>
          <Text style={styles.buttonText}>Ver Mapa</Text>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    padding: 10,
  },
  logo: {
    width: 220,
    height: 220,
    marginBottom: 0,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#7B2CBF",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#9D4EDD",
    textAlign: "center",
  },
  button: {
    marginTop: 32,
    backgroundColor: "#7B2CBF",
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: "#7B2CBF",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
})