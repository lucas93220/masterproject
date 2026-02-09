import { View, Text, Button, ActivityIndicator, Alert } from "react-native";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getProfile } from "../services/api";

export default function Profile({ navigation }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await getProfile();
        setUser(data);
      } catch (error) {
        Alert.alert("Erreur", "Session expirée");
        await AsyncStorage.removeItem("token");
        navigation.replace("Login");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.removeItem("token");
    navigation.replace("Login");
  };

  if (loading) {
    return <ActivityIndicator size="large" />;
  }

  return (
    <View>
      <Text>Profil</Text>

      <Text>Nom : {user.nom}</Text>
      <Text>Prénom : {user.prenom}</Text>
      <Text>Email : {user.email}</Text>
      <Text>Ville : {user.ville}</Text>
      <Text>Rôle : {user.role}</Text>

      <Button title="Se déconnecter" onPress={handleLogout} />
    </View>
  );
}
