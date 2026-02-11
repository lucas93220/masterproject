import {
  View,
  Text,
  TextInput,
  Button,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator
} from "react-native";
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
      const user = await getProfile();
      setNom(user.nom || "");
      setPrenom(user.prenom || "");
      setVille(user.ville || "");
      setTelephone(user.telephone || "");
      setCodePostal(user.code_postal || "");
      setLoading(false);
    };
    loadProfile();
  }, []);

  const handleSave = async () => {
    await updateProfile({
      nom,
      prenom,
      ville,
      telephone,
      code_postal: codePostal
    });
    Alert.alert("Succès", "Profil mis à jour");
  };

  if (loading) return <ActivityIndicator size="large" />;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={{ fontSize: 24, marginBottom: 20 }}>Mon profil</Text>

        <TextInput placeholder="Nom" value={nom} onChangeText={setNom} style={input} />
        <TextInput placeholder="Prénom" value={prenom} onChangeText={setPrenom} style={input} />
        <TextInput placeholder="Ville" value={ville} onChangeText={setVille} style={input} />
        <TextInput placeholder="Téléphone" value={telephone} onChangeText={setTelephone} style={input} />
        <TextInput placeholder="Code postal" value={codePostal} onChangeText={setCodePostal} style={input} />

        <Button title="Enregistrer" onPress={handleSave} />
        <View style={{ marginTop: 10 }}>
          <Button title="Déconnexion" onPress={async () => {
            await AsyncStorage.removeItem("token");
            navigation.replace("Login");
          }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const input = {
  borderWidth: 1,
  padding: 10,
  marginBottom: 10,
  borderRadius: 5
};
