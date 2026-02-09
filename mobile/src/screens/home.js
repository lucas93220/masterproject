import { View, Text, Button, ActivityIndicator, Image } from "react-native";
import { useEffect, useState } from "react";
import { getWeatherForMe } from "../services/api";

export default function Home({ navigation }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
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

    loadWeather();
  }, []);

  if (loading) {
    return <ActivityIndicator size="large" />;
  }

  if (error) {
    return (
      <View>
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
    <View>
      <Text>Météo à {weather.localisation}</Text>

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

      {weather.pluie && <Text>☔ Pense à prendre un parapluie</Text>}
      <Text>💨 Vent : {weather.vent} m/s</Text>

      {/* Navigation */}
      <View style={{ marginTop: 20 }}>
        <Button
          title="Voir mon profil"
          onPress={() => navigation.navigate("Profile")}
        />
      </View>
    </View>
  );
}
