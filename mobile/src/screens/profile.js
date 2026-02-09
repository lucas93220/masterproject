import { View, Text, TextInput, Button, ActivityIndicator, Alert } from "react-native";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getProfile, updateProfile } from "../services/api";

export default function Profile({ navigation }) {
  const [loading, setLoading] = useState(true);

  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [ville, setVille] = useState("");
  const [telephone, setTelephone] = useState("");
  const [codePostal, setCodePostal] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const user = await getProfile();
        setNom(user.nom || "");
        setPrenom(user.prenom || "");
        setVille(user.ville || "");
        setTelephone(user.telephone || "");
        setCodePostal(user.code_postal || "");
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

  const handleSave = async () => {
    try {
      await updateProfile({
        nom,
        prenom,
        ville,
        telephone,
        code_postal: codePostal
      });

      Alert.alert("Succès", "Profil mis à jour");
    } catch (error) {
      Alert.alert("Erreur", error.message);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem("token");
    navigation.replace("Login");
  };

  if (loading) {
    return <ActivityIndicator size="large" />;
  }

  return (
    <View>
      <Text>Mon profil</Text>

      <TextInput placeholder="Nom" value={nom} onChangeText={setNom} />
      <TextInput placeholder="Prénom" value={prenom} onChangeText={setPrenom} />
      <TextInput placeholder="Ville" value={ville} onChangeText={setVille} />
      <TextInput
        placeholder="Téléphone"
        value={telephone}
        onChangeText={setTelephone}
        keyboardType="phone-pad"
      />
      <TextInput
        placeholder="Code postal"
        value={codePostal}
        onChangeText={setCodePostal}
        keyboardType="numeric"
      />

      <Button title="Enregistrer" onPress={handleSave} />

      <View style={{ marginTop: 20 }}>
        <Button title="Se déconnecter" onPress={handleLogout} />
      </View>
    </View>
  );
}
