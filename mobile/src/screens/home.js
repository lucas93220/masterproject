import {
  View,
  Text,
  Button,
  ActivityIndicator,
  Image,
  ScrollView,
  TouchableOpacity,
  Alert
} from "react-native";
import { useEffect, useState } from "react";
import { getWeatherForMe, generateTenue } from "../services/api";

export default function Home({ navigation }) {
  const [weather, setWeather] = useState(null);
  const [tenue, setTenue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadWeather();
  }, []);

  const loadWeather = async () => {
    try {
      const data = await getWeatherForMe();
      setWeather(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTenue = async () => {
    if (!weather) return;

    try {
      setGenerating(true);

      const data = await generateTenue(weather.temperature);
      setTenue(data);

    } catch (err) {
      Alert.alert("Erreur génération", err.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" style={{ marginTop: 40 }} />;
  }

  if (error) {
    return (
      <View style={{ padding: 20 }}>
        <Text>{error}</Text>
        <Button
          title="Voir mon profil"
          onPress={() => navigation.navigate("Profile")}
        />
      </View>
    );
  }

  if (!weather) {
    return <Text>Météo indisponible</Text>;
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>

      {/* MÉTÉO */}
      <Text style={{ fontSize: 20, marginBottom: 10 }}>
        Météo à {weather.localisation}
      </Text>

      <Image
        source={{
          uri: `https://openweathermap.org/img/wn/${weather.icon}@2x.png`
        }}
        style={{ width: 100, height: 100 }}
      />

      <Text>🌡️ {weather.temperature} °C</Text>
      <Text>
        Min {weather.temperature_min}° / Max {weather.temperature_max}°
      </Text>

      <Text>{weather.description}</Text>

      {weather.pluie && (
        <Text>☔ Pense à prendre un parapluie</Text>
      )}

      <Text>💨 Vent : {weather.vent} m/s</Text>

      {/* BOUTON GENERER */}
      <TouchableOpacity
        onPress={handleGenerateTenue}
        style={{
          marginTop: 25,
          backgroundColor: "#007AFF",
          padding: 14,
          borderRadius: 8
        }}
      >
        <Text style={{ color: "white", textAlign: "center" }}>
          {generating ? "Génération..." : "🎲 Générer une tenue"}
        </Text>
      </TouchableOpacity>

      {/* TENUE */}
      {tenue.length > 0 && (
        <View style={{ marginTop: 30 }}>
          <Text style={{ fontSize: 18, marginBottom: 15 }}>
            👕 Ta tenue du jour
          </Text>

          {tenue.map(item => (
            <View key={item.id_vetement} style={{ marginBottom: 20 }}>
              {item.photo ? (
                <Image
                  source={{ uri: item.photo }}
                  style={{
                    width: "100%",
                    height: 180,
                    borderRadius: 10
                  }}
                />
              ) : (
                <View
                  style={{
                    height: 180,
                    backgroundColor: "#eee",
                    borderRadius: 10,
                    justifyContent: "center",
                    alignItems: "center"
                  }}
                >
                  <Text>📸</Text>
                </View>
              )}

              <Text style={{ marginTop: 5 }}>
                {item.nom}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Navigation */}
      <View style={{ marginTop: 20 }}>
        <Button
          title="Voir mon profil"
          onPress={() => navigation.navigate("Profile")}
        />
      </View>

    </ScrollView>
  );
}
