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
import { registerUser } from "../services/api";

import { COLORS } from "../styles/colors";
import { SPACING } from "../styles/spacing";
import { BUTTON_PRIMARY, BUTTON_TEXT } from "../styles/components";

export default function Register({ navigation }) {
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [ville, setVille] = useState("");
  const [telephone, setTelephone] = useState("");
  const [codePostal, setCodePostal] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    try {
      setLoading(true);

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
              Inscription
            </Text>

            <TextInput
              placeholder="Nom"
              value={nom}
              onChangeText={setNom}
              style={styles.input}
              placeholderTextColor={COLORS.muted}
            />

            <TextInput
              placeholder="Prénom"
              value={prenom}
              onChangeText={setPrenom}
              style={styles.input}
              placeholderTextColor={COLORS.muted}
            />

            <TextInput
              placeholder="Ville"
              value={ville}
              onChangeText={setVille}
              style={styles.input}
              placeholderTextColor={COLORS.muted}
            />

            <TextInput
              placeholder="Téléphone"
              value={telephone}
              onChangeText={setTelephone}
              keyboardType="phone-pad"
              style={styles.input}
              placeholderTextColor={COLORS.muted}
            />

            <TextInput
              placeholder="Code postal"
              value={codePostal}
              onChangeText={setCodePostal}
              keyboardType="numeric"
              style={styles.input}
              placeholderTextColor={COLORS.muted}
            />

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
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={BUTTON_TEXT}>
                  Créer le compte
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={{ marginTop: SPACING.md }}
              onPress={() => navigation.navigate("Login")}
            >
              <Text style={styles.loginText}>
                Déjà un compte ? Se connecter
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
  loginText: {
    textAlign: "center",
    color: COLORS.muted,
    fontSize: 14
  }
};