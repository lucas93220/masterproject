import {
  View,
  Text,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator
} from "react-native";
import { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loginUser } from "../services/api";

import { COLORS } from "../styles/colors";
import { SPACING } from "../styles/spacing";
import { BUTTON_PRIMARY, BUTTON_TEXT } from "../styles/components";

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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>

            <Text style={styles.title}>
              Connexion
            </Text>

            <TextInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              style={styles.input}
              placeholderTextColor={COLORS.muted}
            />

            <TextInput
              placeholder="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={styles.input}
              placeholderTextColor={COLORS.muted}
            />

            <TouchableOpacity
              style={[
                BUTTON_PRIMARY,
                { marginTop: SPACING.md, opacity: loading ? 0.7 : 1 }
              ]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={BUTTON_TEXT}>
                  Se connecter
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={{ marginTop: SPACING.md }}
              onPress={() => navigation.navigate("Register")}
            >
              <Text style={styles.registerText}>
                Créer un compte
              </Text>
            </TouchableOpacity>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: SPACING.lg
  },
  card: {
    backgroundColor: COLORS.card,
    padding: SPACING.lg,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: SPACING.lg,
    color: COLORS.text
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: SPACING.md,
    backgroundColor: "#fff"
  },
  registerText: {
    textAlign: "center",
    color: COLORS.muted,
    fontSize: 14
  }
};