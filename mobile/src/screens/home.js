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
import { getWeatherForMe, generateTenue, evaluateTenue } from "../services/api";

import { COLORS } from "../styles/colors";
import { SPACING } from "../styles/spacing";
import { CARD, BUTTON_PRIMARY, BUTTON_TEXT } from "../styles/components";

export default function Home() {
  const [weather, setWeather] = useState(null);
  const [tenue, setTenue] = useState([]);
  const [tenueId, setTenueId] = useState(null);
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
      setTenue(data.vetements || []);
      setTenueId(data.id_tenue || null);
    } catch (err) {
      Alert.alert("Erreur génération", err.message);
    } finally {
      setGenerating(false);
    }
  };

 const handleEvaluation = async (isLiked) => {
  if (!tenueId) return;

  try {
    await evaluateTenue(tenueId, isLiked);

    if (isLiked) {
      setTenueId(null);
    } else {
      const data = await generateTenue(weather.temperature);
      setTenue(data.vetements || []);
      setTenueId(data.id_tenue || null);
    }

  } catch (err) {
    Alert.alert("Erreur", err.message);
  }
};

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={{ color: COLORS.text }}>{error}</Text>
      </SafeAreaView>
    );
  }

  if (!weather) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text>Météo indisponible</Text>
      </SafeAreaView>
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
          <View style={styles.tenueSection}>
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
                  <Text style={styles.itemName}>{item.nom}</Text>
                </View>
              ))}
            </View>

            {/* FEEDBACK */}
            {tenueId && (
              <View style={styles.feedbackContainer}>
                <TouchableOpacity
                  style={styles.likeButton}
                  onPress={() => handleEvaluation(true)}
                >
                  <Text style={styles.feedbackText}>👍 J'aime</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dislikeButton}
                  onPress={() => handleEvaluation(false)}
                >
                  <Text style={styles.feedbackText}>👎 Je n'aime pas</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* BOUTON GENERATION */}
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
  tenueSection: {
    marginTop: SPACING.lg
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: SPACING.md,
    color: COLORS.text
  },
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
  itemName: {
    marginTop: 5,
    color: COLORS.text
  },
  placeholder: {
    backgroundColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center"
  },
  feedbackContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: SPACING.md
  },
  likeButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 12,
    borderRadius: 30,
    width: "48%",
    alignItems: "center"
  },
  dislikeButton: {
    backgroundColor: "#E53935",
    paddingVertical: 12,
    borderRadius: 30,
    width: "48%",
    alignItems: "center"
  },
  feedbackText: {
    color: "#fff",
    fontWeight: "600"
  }
};