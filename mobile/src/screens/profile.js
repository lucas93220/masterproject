import {
  View,
  Text,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView
} from "react-native";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getProfile, updateProfile } from "../services/api";

import { COLORS } from "../styles/colors";
import { SPACING } from "../styles/spacing";
import { BUTTON_PRIMARY, BUTTON_TEXT } from "../styles/components";

export default function Profile({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      } catch (e) {
        Alert.alert("Erreur", "Impossible de charger le profil");
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateProfile({
        nom,
        prenom,
        ville,
        telephone,
        code_postal: codePostal
      });
      Alert.alert("Succès", "Profil mis à jour");
    } catch {
      Alert.alert("Erreur", "Impossible de sauvegarder");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem("token");
    navigation.replace("Login");
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>

          <View style={styles.card}>
            <Text style={styles.title}>Mon profil</Text>

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
              style={styles.input}
              placeholderTextColor={COLORS.muted}
            />

            <TextInput
              placeholder="Code postal"
              value={codePostal}
              onChangeText={setCodePostal}
              style={styles.input}
              placeholderTextColor={COLORS.muted}
            />

            <TouchableOpacity
              style={[
                BUTTON_PRIMARY,
                { marginTop: SPACING.md, opacity: saving ? 0.7 : 1 }
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={BUTTON_TEXT}>Enregistrer</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={{ marginTop: SPACING.md }}
              onPress={handleLogout}
            >
              <Text style={styles.logoutText}>
                Déconnexion
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
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background
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
  logoutText: {
    textAlign: "center",
    color: COLORS.muted,
    fontSize: 14
  }
};