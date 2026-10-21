import { View, Text, Alert } from "react-native";
import { useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loginUser } from "../services/api";
import { Screen, Field, Button, IconButton, layout } from "../components/ui";
import { COLORS } from "../styles/colors";
import { TYPE } from "../styles/theme";

export default function Login({ navigation }) {
  const [showPassword, setShowPassword] = useState(false);
  const pending = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    try {
      const data = await loginUser(email, password);
      await AsyncStorage.setItem("token", data.token);
      navigation.replace("Main");
    } catch (error) {
      const message = ["Network request failed", "Failed to fetch"].includes(error?.message)
        ? "Impossible de joindre le serveur. Vérifie le réseau et l'adresse de l'API."
        : error?.message || "Connexion impossible. Réessaie.";
      Alert.alert(
        "Erreur de connexion",
        message
      );
    } finally {
      pending.current = false;
      setLoading(false);
    }
  };

  return <Screen scroll keyboard edges={["top", "bottom"]} contentStyle={{ flexGrow: 1, justifyContent: "center", gap: 32 }}>
    <View style={{ gap: 20 }}>
      <View style={layout.between}>
        <Text style={{ fontSize: 32, letterSpacing: -2, fontWeight: "800", color: COLORS.primary }}>fits.</Text>
        <Text style={[TYPE.eyebrow, { flexShrink: 1, textAlign: "right" }]}>LE STYLE EST DÉJÀ LÀ.</Text>
      </View>
      <View style={{ padding: 28, borderRadius: 28, backgroundColor: COLORS.primary, gap: 20 }}>
        <Ionicons name="shirt-outline" size={32} color={COLORS.accent} />
        <Text style={{ ...TYPE.display, color: "#fff", fontSize: 34, lineHeight: 40 }}>{"Ton dressing.\nD’autres idées."}</Text>
        <Text style={{ ...TYPE.body, color: "#EDF2E8" }}>Redécouvre ton dressing, une tenue à la fois.</Text>
      </View>
    </View>
    <View style={{ gap: 18 }}>
      <Text accessibilityRole="header" style={TYPE.title}>Heureux de te retrouver.</Text>
      <Field label="Adresse e-mail" placeholder="toi@exemple.fr" value={email} onChangeText={setEmail}
        autoCapitalize="none" keyboardType="email-address" autoComplete="email" editable={!loading} />
      <Field label="Mot de passe" placeholder="Ton mot de passe" value={password} onChangeText={setPassword}
        secureTextEntry={!showPassword} autoCapitalize="none" autoComplete="current-password" editable={!loading}
        onSubmitEditing={handleLogin} returnKeyType="go"
        trailing={<IconButton icon={showPassword ? "eye-off-outline" : "eye-outline"}
          label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} onPress={() => setShowPassword(!showPassword)} />} />
      <Button title="Se connecter" onPress={handleLogin} loading={loading} icon="arrow-forward" />
      <Button title="Créer un compte" variant="secondary" onPress={() => navigation.navigate("Register")} disabled={loading} />
    </View>
  </Screen>;
}
