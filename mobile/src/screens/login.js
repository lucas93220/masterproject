import { View, Text, TextInput, Button, Alert } from "react-native";
import { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loginUser } from "../services/api";

export default function Login({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      const data = await loginUser(email, password);

      await AsyncStorage.setItem("token", data.token);

      navigation.replace("Home");
    } catch (error) {
      Alert.alert("Erreur", "Email ou mot de passe incorrect");
    }
  };

  return (
    <View>
      <Text>Login</Text>

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

      <Button title="Se connecter" onPress={handleLogin} />

      <Button
        title="Créer un compte"
        onPress={() => navigation.navigate("Register")}
      />
    </View>
  );
}
