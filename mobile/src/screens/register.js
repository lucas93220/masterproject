import {
  View,
  Text,
  TextInput,
  Button,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from "react-native";
import { useState } from "react";
import { registerUser } from "../services/api";

export default function Register({ navigation }) {
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [ville, setVille] = useState("");
  const [telephone, setTelephone] = useState("");
  const [codePostal, setCodePostal] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    try {
      await registerUser({
        nom,
        prenom,
        ville,
        telephone,
        code_postal: codePostal,
        email,
        password
      });

      Alert.alert("Succès", "Compte créé", [
        { text: "OK", onPress: () => navigation.navigate("Login") }
      ]);
    } catch (error) {
      Alert.alert("Erreur", error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: 20
        }}
      >
        <Text style={{ fontSize: 24, marginBottom: 20 }}>
          Inscription
        </Text>

        <TextInput placeholder="Nom" value={nom} onChangeText={setNom} style={input} />
        <TextInput placeholder="Prénom" value={prenom} onChangeText={setPrenom} style={input} />
        <TextInput placeholder="Ville" value={ville} onChangeText={setVille} style={input} />
        <TextInput placeholder="Téléphone" value={telephone} onChangeText={setTelephone} keyboardType="phone-pad" style={input} />
        <TextInput placeholder="Code postal" value={codePostal} onChangeText={setCodePostal} keyboardType="numeric" style={input} />
        <TextInput placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" style={input} />
        <TextInput placeholder="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry style={input} />

        <Button title="Créer le compte" onPress={handleRegister} />
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
