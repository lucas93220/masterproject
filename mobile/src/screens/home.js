import { View, Text, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { getWeatherForMe, generateTenue, evaluateTenue } from "../services/api";
import ClothingImage from "../components/ClothingImage";
import { Screen, Heading, Button, EmptyState, Notice, Sheet, layout } from "../components/ui";
import { COLORS } from "../styles/colors";
import { TYPE } from "../styles/theme";

const weatherIcons = { "01": "sunny-outline", "02": "partly-sunny-outline", "03": "cloud-outline",
  "04": "cloudy-outline", "09": "rainy-outline", "10": "rainy-outline", "11": "thunderstorm-outline",
  "13": "snow-outline", "50": "cloud-outline" };

export default function Home({ navigation }) {
  const [preview, setPreview] = useState(null);
  const [weather, setWeather] = useState(null);
  const [tenue, setTenue] = useState([]);
  const [tenueId, setTenueId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState(null);
  const actionInProgress = useRef(false);
  const isBusy = generating || evaluating;

  useEffect(() => {
    loadWeather();
  }, []);

  const loadWeather = async () => {
    setLoading(true);
    setError(null);
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
    if (!weather || actionInProgress.current) return;

    actionInProgress.current = true;

    try {
      setGenerating(true);
      const data = await generateTenue(weather.temperature, weather.icon);
      setTenue(data.vetements || []);
      setTenueId(data.id_tenue || null);
    } catch (err) {
      Alert.alert("Erreur génération", err.message);
    } finally {
      setGenerating(false);
      actionInProgress.current = false;
    }
  };

  const handleEvaluation = async (isLiked) => {
    if (!tenueId || actionInProgress.current) return;

    actionInProgress.current = true;
    setEvaluating(true);

    try {
      try {
        await evaluateTenue(tenueId, isLiked);
      } catch (err) {
        Alert.alert("Erreur d’évaluation", "Impossible d’enregistrer ton avis : " + err.message);
        return;
      }

      setTenueId(null);

      if (!isLiked) {
        setGenerating(true);
        try {
          const data = await generateTenue(weather.temperature, weather.icon);
          setTenue(data.vetements || []);
          setTenueId(data.id_tenue || null);
        } catch (err) {
          Alert.alert("Erreur génération", "Ton avis a été enregistré, mais la génération a échoué : " + err.message);
        }
      }
    } finally {
      setEvaluating(false);
      setGenerating(false);
      actionInProgress.current = false;
    }
  };

  if (loading) {
    return <Screen><View style={styles.centered}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={TYPE.caption}>Un instant, on regarde la météo…</Text>
    </View></Screen>;
  }
  if (error || !weather) {
    return <Screen scroll>
      <Heading eyebrow="FITS · AUJOURD’HUI" title="À chaque jour, sa tenue." />
      <EmptyState icon="cloud-offline-outline" title="La météo fait une pause"
        description={error || "La météo est momentanément indisponible."}
        action={<Button title="Réessayer" icon="refresh-outline" onPress={loadWeather} />} />
      <Button title="Vérifier ma ville" variant="secondary" onPress={() => navigation.navigate("Profile")} />
    </Screen>;
  }

  return <Screen scroll>
    <Heading eyebrow="FITS · TON DRESSING, AUTREMENT" title={"Qu’est-ce qu’on\nporte aujourd’hui ?"} />
    <View style={styles.weather}>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={layout.row}>
          <Ionicons name="location-outline" size={14} color={COLORS.accent} />
          <Text style={{ ...TYPE.caption, color: "#EDF2E8" }}>{weather.ville || weather.localisation || "La météo du jour"}</Text>
        </View>
        <Text style={styles.temperature}>{Math.round(weather.temperature)}°
          <Text style={{ fontSize: 16 }}> C</Text>
        </Text>
        {weather.description ? <Text style={{ ...TYPE.caption, color: "#EDF2E8", textTransform: "capitalize" }}>{weather.description}</Text> : null}
      </View>
      <View style={styles.weatherSymbol}>
        <Ionicons name={weather.icon === "01n" ? "moon-outline" : weatherIcons[weather.icon?.slice(0, 2)] || "cloud-outline"}
          size={44} color={COLORS.accent} />
      </View>
    </View>

    {tenue.length ? <View style={{ gap: 18 }}>
      <View style={layout.between}>
        <View style={{ gap: 4 }}>
          <Text style={TYPE.eyebrow}>TA SÉLECTION DU JOUR</Text>
          <Text style={TYPE.title}>À toi de voir.</Text>
        </View>
        <Text style={styles.count}>{tenue.length} pièces</Text>
      </View>
      <View style={styles.grid}>
        {tenue.map((item, index) => <TouchableOpacity key={item.id_vetement}
          accessibilityRole="button" accessibilityLabel={`Voir ${item.nom}`} onPress={() => setPreview(item)}
          activeOpacity={0.8} style={styles.outfitCard}>
          <ClothingImage uri={item.photo} accessibilityLabel={`Photo : ${item.nom}`} style={styles.outfitImage} />
          <View style={{ padding: 12, gap: 4 }}>
            <Text numberOfLines={2} style={{ ...TYPE.body, fontWeight: "600", fontSize: 14 }}>{item.nom}</Text>
            <Text numberOfLines={1} style={TYPE.caption}>{item.marque || `Pièce ${index + 1}`}</Text>
          </View>
        </TouchableOpacity>)}
      </View>
      {tenueId ? <View style={styles.feedback}>
        <Text style={{ ...TYPE.body, fontWeight: "600" }}>Tu porterais cette tenue ?</Text>
        <Text style={TYPE.caption}>Pense au style et à la météo du jour.</Text>
        <View style={[layout.row, { marginTop: 6 }]}>
          <TouchableOpacity onPress={() => handleEvaluation(false)} disabled={isBusy}
            accessibilityRole="button" accessibilityLabel="Je n’aime pas cette tenue, en proposer une autre"
            accessibilityState={{ disabled: isBusy }} style={[styles.vote, { opacity: isBusy ? 0.5 : 1 }]}>
            <Ionicons name="close" size={22} color={COLORS.text} /><Text style={TYPE.body}>Pas pour moi</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleEvaluation(true)} disabled={isBusy}
            accessibilityRole="button" accessibilityLabel="J’aime cette tenue"
            accessibilityState={{ disabled: isBusy }} style={[styles.vote, { backgroundColor: COLORS.primary, opacity: isBusy ? 0.5 : 1 }]}>
            <Ionicons name="heart" size={20} color={COLORS.accent} /><Text style={{ ...TYPE.body, color: "#fff" }}>J’aime</Text>
          </TouchableOpacity>
        </View>
        {evaluating ? <Text accessibilityLiveRegion="polite" style={TYPE.caption}>Enregistrement de ton avis…</Text> : null}
      </View> : !isBusy ? <Notice message="Ton avis a été enregistré. Tu peux explorer une autre idée." /> : null}
    </View> : <View style={styles.intro}>
      <View style={styles.introIcon}><Ionicons name="shirt-outline" size={44} color={COLORS.primary} /></View>
      <Text style={[TYPE.display, { fontSize: 28, lineHeight: 34, textAlign: "center" }]}>{"De nouvelles idées.\nTes propres vêtements."}</Text>
      <Text style={[TYPE.body, { textAlign: "center", color: COLORS.muted }]}>Une proposition à partir de ton dressing et de la météo. À toi de nous dire si elle te plaît.</Text>
    </View>}

    <Button title={generating ? "Génération..." : "Générer ma tenue"} icon="sparkles-outline"
      loading={generating} disabled={isBusy} onPress={handleGenerateTenue} />
    {!tenue.length ? <Button title="Compléter mon dressing" variant="secondary" icon="add-outline"
      onPress={() => navigation.navigate("Dressing", { screen: "AddClothing" })} /> : null}
    <Sheet visible={!!preview} title={preview?.nom || "Le vêtement"} subtitle={preview?.marque} onClose={() => setPreview(null)}>
      {preview ? <ClothingImage uri={preview.photo} style={{ width: "100%", height: 360, borderRadius: 20, backgroundColor: COLORS.soft }} /> : null}
    </Sheet>
  </Screen>;
}

const styles = {
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18 },
  weather: { ...layout.between, padding: 24, backgroundColor: COLORS.primary, borderRadius: 26 },
  temperature: { fontSize: 48, fontWeight: "500", letterSpacing: -2, color: "#fff" },
  weatherSymbol: { width: 92, height: 92, backgroundColor: "#365E4F", borderRadius: 46, justifyContent: "center", alignItems: "center" },
  intro: { backgroundColor: COLORS.warm, padding: 28, borderRadius: 26, alignItems: "center", gap: 18 },
  introIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 },
  outfitCard: { width: "48%", backgroundColor: COLORS.card, borderRadius: 20, overflow: "hidden" },
  outfitImage: { width: "100%", aspectRatio: 0.92, backgroundColor: "#EDEEE8" },
  count: { ...TYPE.caption, backgroundColor: COLORS.soft, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  feedback: { ...layout.card, gap: 8 },
  vote: { minHeight: 54, padding: 10, flex: 1, backgroundColor: COLORS.background, borderRadius: 14,
    flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 8 }
};
