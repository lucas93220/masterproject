import { View, Text, Alert } from "react-native";
import { useRef, useState } from "react";
import { registerUser } from "../services/api";
import { Screen, Heading, Field, Button, IconButton, layout } from "../components/ui";
import { TYPE } from "../styles/theme";

export default function Register({ navigation }) {
  const [showPassword, setShowPassword] = useState(false);
  const pending = useRef(false);
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [ville, setVille] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (pending.current) return;
    pending.current = true;
    try {
      setLoading(true);

      await registerUser({
        nom,
        prenom,
        ville,
        email,
        password
      });

      Alert.alert("Succès", "Compte créé", [
        { text: "OK", onPress: () => navigation.navigate("Login") }
      ]);
    } catch (error) {
      Alert.alert("Erreur", error.message);
    } finally {
      pending.current = false;
      setLoading(false);
    }
  };

  return <Screen scroll keyboard edges={["top", "bottom"]}>
    <View style={layout.row}><IconButton icon="arrow-back" label="Retour à la connexion" disabled={loading}
      onPress={() => navigation.navigate("Login")} /><Text style={TYPE.eyebrow}>BIENVENUE CHEZ FITS</Text></View>
    <Heading title="Ton style commence ici." subtitle="Crée ton compte, ajoute tes pièces et explore les possibilités." />
    <View style={layout.card}>
      <Text style={layout.sectionLabel}>01 · TOI</Text>
      <Field label="Prénom" placeholder="Ton prénom" value={prenom} onChangeText={setPrenom} autoComplete="given-name" editable={!loading} />
      <Field label="Nom" placeholder="Ton nom" value={nom} onChangeText={setNom} autoComplete="family-name" editable={!loading} />
    </View>
    <View style={layout.card}>
      <Text style={layout.sectionLabel}>02 · TA MÉTÉO</Text>
      <Text style={TYPE.caption}>Ta ville nous permet d’adapter les suggestions à la météo.</Text>
      <Field label="Ville" placeholder="Ta ville" value={ville} onChangeText={setVille} autoComplete="address-level2" editable={!loading} />
    </View>
    <View style={layout.card}>
      <Text style={layout.sectionLabel}>03 · TES IDENTIFIANTS</Text>
      <Field label="Adresse e-mail" placeholder="toi@exemple.fr" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" editable={!loading} />
      <Field label="Mot de passe" placeholder="Choisis un mot de passe" value={password} onChangeText={setPassword}
        secureTextEntry={!showPassword} autoCapitalize="none" autoComplete="new-password" editable={!loading}
        trailing={<IconButton icon={showPassword ? "eye-off-outline" : "eye-outline"} label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          onPress={() => setShowPassword(!showPassword)} />} />
    </View>
    <Button title="Créer le compte" onPress={handleRegister} loading={loading} icon="arrow-forward" />
    <Button title="Déjà un compte ? Se connecter" variant="secondary" disabled={loading} onPress={() => navigation.navigate("Login")} />
  </Screen>;
}
