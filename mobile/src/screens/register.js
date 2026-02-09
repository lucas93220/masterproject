import { View, Text, TextInput, Button, Alert } from "react-native";
import { useState } from "react";
import { registerUser } from "../services/api";

export default function Register({ navigation }) {
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [ville, setVille] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [telephone, setTelephone] = useState("");
  const [codePostal, setCodePostal] = useState("");


  const handleRegister = async () => {
    if (!nom || !prenom || !ville || !email || !password) {
      Alert.alert("Erreur", "Tous les champs sont obligatoires");
      return;
    }

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


      Alert.alert(
        "Succès",
        "Compte créé avec succès",
        [{ text: "OK", onPress: () => navigation.navigate("Login") }]
      );
    } catch (error) {
      Alert.alert("Erreur", error.message);
    }
  };

  return (
    <View>
      <Text>Inscription</Text>

      <TextInput placeholder="Nom" value={nom} onChangeText={setNom} />
      <TextInput placeholder="Prénom" value={prenom} onChangeText={setPrenom} />
      <TextInput placeholder="Ville" value={ville} onChangeText={setVille} />
      <TextInput
        placeholder="Code postal"
        value={codePostal}
        onChangeText={setCodePostal}
        keyboardType="numeric"
      />
      <TextInput
        placeholder="Téléphone"
        value={telephone}
        onChangeText={setTelephone}
        keyboardType="phone-pad"
      />

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Button title="S'inscrire" onPress={handleRegister} />

      <Button
        title="Retour à la connexion"
        onPress={() => navigation.navigate("Login")}
      />
    </View>
  );
}
