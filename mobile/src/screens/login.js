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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loginUser } from "../services/api";

export default function Login({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const data = await loginUser(email, password);
      await AsyncStorage.setItem("token", data.token);
      navigation.replace("Main");
    } catch (error) {
      Alert.alert(
        "Erreur de connexion",
        "Email ou mot de passe incorrect"
      );
    } finally {
      setLoading(false);
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
        keyboardShouldPersistTaps="handled"
      >
        <View>
          <Text style={{ fontSize: 24, marginBottom: 20 }}>
            Connexion
          </Text>

          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            style={{
              borderWidth: 1,
              padding: 10,
              marginBottom: 10,
              borderRadius: 5
            }}
          />

          <TextInput
            placeholder="Mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={{
              borderWidth: 1,
              padding: 10,
              marginBottom: 20,
              borderRadius: 5
            }}
          />

          <Button
            title={loading ? "Connexion..." : "Se connecter"}
            onPress={handleLogin}
            disabled={loading}
          />

          <View style={{ marginTop: 10 }}>
            <Button
              title="Créer un compte"
              onPress={() => navigation.navigate("Register")}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
