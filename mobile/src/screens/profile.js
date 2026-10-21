import { View, Text, Alert, Platform, ActivityIndicator } from "react-native";
import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { deleteMyAccount, getProfile, updateProfile } from "../services/api";
import { Screen, Heading, Field, Button, EmptyState, layout } from "../components/ui";
import { COLORS } from "../styles/colors";
import { TYPE } from "../styles/theme";

export default function Profile({ navigation }) {
  const [loadError, setLoadError] = useState(null);
  const savingRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);
  const confirmationOpenRef = useRef(false);

  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [ville, setVille] = useState("");
  const [telephone, setTelephone] = useState("");
  const [codePostal, setCodePostal] = useState("");

  const loadProfile = async () => {
    setLoading(true); setLoadError(null);
    try {
      const user = await getProfile();
      setNom(user.nom || ""); setPrenom(user.prenom || "");
      setVille(user.ville || ""); setTelephone(user.telephone || "");
      setCodePostal(user.code_postal || "");
    } catch { setLoadError("Impossible de charger le profil. Réessaie pour retrouver tes informations."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadProfile(); }, []);

  const handleSave = async () => {
    if (deletingRef.current || savingRef.current || loadError) return;
    savingRef.current = true;
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
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (savingRef.current || deletingRef.current) return;
    try {
      await AsyncStorage.removeItem("token");
      navigation.getParent()?.reset({ index: 0, routes: [{ name: "Login" }] });
    } catch { Alert.alert("Déconnexion impossible", "Réessaie pour fermer ta session."); }
  };

  const showDeletionMessage = (title, message) => {
    if (Platform.OS === "web") {
      globalThis.alert(`${title}\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const confirmDeletion = async () => {
    confirmationOpenRef.current = false;
    if (deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    let result;
    try {
      result = await deleteMyAccount();
    } catch (error) {
      deletingRef.current = false;
      setDeleting(false);
      showDeletionMessage("Suppression impossible", error.message || "Réessaie plus tard.");
      return;
    }

    let sessionClearFailed = false;
    try {
      await AsyncStorage.removeItem("token");
    } catch {
      sessionClearFailed = true;
    }
    navigation.getParent()?.reset({ index: 0, routes: [{ name: "Login" }] });
    showDeletionMessage(
      "Compte supprimé",
      sessionClearFailed
        ? "Le compte a été supprimé, mais la session locale n'a pas pu être effacée."
        : result?.message || "Ton compte a été supprimé."
    );
  };

  const handleDelete = () => {
    if (savingRef.current || deletingRef.current || confirmationOpenRef.current) return;
    const title = "Supprimer mon compte ?";
    const message = "Cette action est définitive. Ton profil, ton dressing et tes avis seront supprimés.";
    if (Platform.OS === "web") {
      if (globalThis.confirm(`${title}\n${message}`)) void confirmDeletion();
      return;
    }
    confirmationOpenRef.current = true;
    Alert.alert(
      title,
      message,
      [
        {
          text: "Annuler",
          style: "cancel",
          onPress: () => { confirmationOpenRef.current = false; }
        },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: confirmDeletion
        }
      ],
      { cancelable: false }
    );
  };

  if (loading) return <Screen><View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
    <ActivityIndicator size="large" color={COLORS.primary} /></View></Screen>;
  if (loadError) return <Screen scroll><Heading eyebrow="TON ESPACE" title="Mon profil." />
    <EmptyState icon="person-outline" title="Profil indisponible" description={loadError}
      action={<Button title="Réessayer" onPress={loadProfile} />} />
    <Button title="Déconnexion" variant="secondary" onPress={handleLogout} />
  </Screen>;
  const disabled = saving || deleting;
  const initials = `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase() || "F";
  return <Screen scroll keyboard>
    <Heading eyebrow="TON ESPACE" title="À ton image." subtitle="Tes informations, ton dressing, tes choix." />
    <View style={{ ...layout.row, backgroundColor: COLORS.primary, padding: 24, borderRadius: 26, gap: 18 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.accent, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: COLORS.primary, fontWeight: "600", fontSize: 24 }}>{initials}</Text>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ ...TYPE.title, color: "#fff" }}>{prenom || "Mon profil"}</Text>
        <Text style={{ ...TYPE.caption, color: "#EDF2E8" }}>{ville || "Ta ville reste à renseigner"}</Text>
      </View>
    </View>
    <View style={layout.card}>
      <Text style={layout.sectionLabel}>MES INFORMATIONS</Text>
      <Field label="Prénom" placeholder="Ton prénom" value={prenom} onChangeText={setPrenom} editable={!disabled} autoComplete="given-name" />
      <Field label="Nom" placeholder="Ton nom" value={nom} onChangeText={setNom} editable={!disabled} autoComplete="family-name" />
      <Field label="Téléphone" placeholder="Ton numéro" value={telephone} onChangeText={setTelephone} editable={!disabled} keyboardType="phone-pad" autoComplete="tel" />
    </View>
    <View style={layout.card}>
      <View style={layout.row}><Ionicons name="location-outline" size={20} color={COLORS.primary} /><Text style={layout.sectionLabel}>MA MÉTÉO LOCALE</Text></View>
      <Text style={TYPE.caption}>Ta ville permet de récupérer la météo utilisée pour les suggestions.</Text>
      <Field label="Ville" placeholder="Ta ville" value={ville} onChangeText={setVille} editable={!disabled} autoComplete="address-level2" />
      <Field label="Code postal" placeholder="Ton code postal" value={codePostal} onChangeText={setCodePostal} editable={!disabled} keyboardType="number-pad" autoComplete="postal-code" />
    </View>
    <Button title="Enregistrer" loading={saving} disabled={disabled} icon="checkmark-outline" onPress={handleSave} />
    <View style={{ gap: 12 }}>
      <Text style={layout.sectionLabel}>MON COMPTE</Text>
      <Button title="Déconnexion" variant="secondary" icon="log-out-outline" disabled={disabled} onPress={handleLogout} />
      <Button title="Supprimer mon compte" variant="danger" icon="trash-outline" loading={deleting} disabled={disabled}
        accessibilityHint="Supprime définitivement le compte après confirmation" onPress={handleDelete} />
      <Text style={[TYPE.caption, { textAlign: "center" }]}>La suppression est définitive et nécessite ta confirmation.</Text>
    </View>
  </Screen>;
}
