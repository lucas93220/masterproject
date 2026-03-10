import {
  View,
  Text,
  ActivityIndicator,
  Image,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView
} from "react-native";
import { useEffect, useState } from "react";
import { getWeatherForMe, generateTenue } from "../services/api";

import { COLORS } from "../styles/colors";
import { SPACING } from "../styles/spacing";
import { CARD, BUTTON_PRIMARY, BUTTON_TEXT } from "../styles/components";

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
      setTenue(data.vetements);
    } catch (err) {
      Alert.alert("Erreur génération", err.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={{ color: COLORS.text }}>{error}</Text>
      </View>
    );
  }

  if (!weather) {
    return (
      <View style={styles.centered}>
        <Text>Météo indisponible</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* METEO */}
        <View style={CARD}>
          <Text style={styles.city}>{weather.localisation}</Text>

          <View style={styles.weatherRow}>
            <Image
              source={{
                uri: `https://openweathermap.org/img/wn/${weather.icon}@2x.png`
              }}
              style={styles.weatherIcon}
            />
            <Text style={styles.temperature}>
              {weather.temperature}°C
            </Text>
          </View>
        </View>

        {/* TENUE */}
        {tenue.length > 0 && (
          <View style={{ marginTop: SPACING.lg }}>
            <Text style={styles.sectionTitle}>
              Ta tenue du jour
            </Text>

            <View style={styles.outfitGrid}>
              {tenue.map(item => (
                <View key={item.id_vetement} style={styles.outfitCard}>
                  {item.photo ? (
                    <Image
                      source={{ uri: item.photo }}
                      style={styles.outfitImage}
                    />
                  ) : (
                    <View style={[styles.outfitImage, styles.placeholder]}>
                      <Text>📸</Text>
                    </View>
                  )}

              <Text style={{ marginTop: 5 }}>
                {item.nom}
              </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* BOUTON */}
        <TouchableOpacity
          onPress={handleGenerateTenue}
          style={[BUTTON_PRIMARY, { marginTop: SPACING.lg }]}
        >
          <Text style={BUTTON_TEXT}>
            {generating ? "Génération..." : "Générer ma tenue"}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  content: {
    padding: SPACING.md
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.md
  },
  city: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text
  },
  weatherRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.sm
  },
  weatherIcon: {
    width: 50,
    height: 50
  },
  temperature: {
    fontSize: 22,
    fontWeight: "bold",
    marginLeft: SPACING.sm,
    color: COLORS.text
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: SPACING.md,
    color: COLORS.text
  },

  /* GRID tenue */
  outfitGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between"
  },
  outfitCard: {
    width: "48%",
    marginBottom: SPACING.md
  },
  outfitImage: {
    width: "100%",
    height: 90,
    borderRadius: 12
  },
  placeholder: {
    backgroundColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center"
  }
};