import { View, Text, Alert, Switch, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { addClothing, updateClothing, deleteClothing, getCategories, getSousCategoriesByCategorie, uploadImage } from "../services/api";
import ClothingImage from "../components/ClothingImage";
import { Screen, Heading, Button, Field, Sheet, Notice, layout } from "../components/ui";
import { COLORS } from "../styles/colors";
import { CLOTHING_COLORS } from "../styles/clothingPalette";
import { TYPE } from "../styles/theme";
import { thermalDefaults } from "../services/thermalDefaults";

export default function AddClothing({ navigation, route }) {
  const editingClothing = route?.params?.clothing || null;
  const [photo, setPhoto] = useState(editingClothing?.photo || null);
  const [pickedImage, setPickedImage] = useState(null);
  const [nom, setNom] = useState(editingClothing?.nom || "");
  const [marque, setMarque] = useState(editingClothing?.marque || "");
  const [couleur, setCouleur] = useState(editingClothing?.couleur || "");
  const [tempMin, setTempMin] = useState(editingClothing?.temperature_min?.toString() || "");
  const [tempMax, setTempMax] = useState(editingClothing?.temperature_max?.toString() || "");
  const [thermalMode, setThermalMode] = useState(editingClothing ? "manual" : "auto");
  const [showThermalDetails, setShowThermalDetails] = useState(false);
  const [favori, setFavori] = useState(editingClothing?.favori || false);
  const [categories, setCategories] = useState([]);
  const [sousCategories, setSousCategories] = useState([]);
  const [idSousCategorie, setIdSousCategorie] = useState(editingClothing?.id_sous_categorie || null);
  const [categoryLabel, setCategoryLabel] = useState(editingClothing?.sous_categorie?.nom_sous_categorie || "");
  const [modalVisible, setModalVisible] = useState(false);
  const [currentView, setCurrentView] = useState("categories");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const busy = useRef(false);
  const catalogRequest = useRef(0);
  const uploaded = useRef(null);
  const estimatedThermal = thermalDefaults(categoryLabel);
  const thermalMin = thermalMode === "auto" ? estimatedThermal.min : tempMin;
  const thermalMax = thermalMode === "auto" ? estimatedThermal.max : tempMax;

  useEffect(() => () => { catalogRequest.current += 1; }, []);

  const loadCatalog = async (categoryId = null) => {
    const request = ++catalogRequest.current;
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const data = categoryId ? await getSousCategoriesByCategorie(categoryId) : await getCategories();
      if (request !== catalogRequest.current) return;
      if (categoryId) { setSousCategories(data); setCurrentView("sousCategories"); }
      else { setCategories(data); setCurrentView("categories"); }
    } catch {
      if (request === catalogRequest.current) setCatalogError("Impossible de charger les catégories. Réessaie.");
    } finally {
      if (request === catalogRequest.current) setCatalogLoading(false);
    }
  };
  const closeCatalog = () => { catalogRequest.current += 1; setModalVisible(false); setCatalogLoading(false); };

  const pickImage = async () => {
    if (busy.current) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
      if (!result.canceled && result.assets?.[0]) {
        setPickedImage(result.assets[0]);
        setPhoto(result.assets[0].uri);
        uploaded.current = null;
      }
    } catch {
      setError("Impossible d’ouvrir les photos. Vérifie l’accès à ta photothèque dans les réglages.");
    }
  };

  const handleSubmit = async () => {
    if (busy.current) return;
    if (!nom.trim() || !idSousCategorie) { setError("Ajoute un nom et choisis une catégorie de vêtement."); return; }
    if (!Object.keys(CLOTHING_COLORS).includes(couleur)) { setError("Choisis une couleur dans la palette."); return; }
    const min = thermalMode === "auto" ? thermalMin : tempMin.trim() ? Number(tempMin.replace(",", ".")) : 0;
    const max = thermalMode === "auto" ? thermalMax : tempMax.trim() ? Number(tempMax.replace(",", ".")) : 50;
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
      setError("Indique des températures valides, avec un minimum inférieur ou égal au maximum."); return;
    }
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      let imageUrl = photo;
      if (pickedImage || /^(?:file|content):\/\//.test(photo || "")) {
        if (uploaded.current?.uri === photo) imageUrl = uploaded.current.url;
        else {
          imageUrl = await uploadImage(photo, pickedImage?.mimeType);
          uploaded.current = { uri: photo, url: imageUrl };
        }
      }
      const payload = { nom: nom.trim(), marque: marque.trim(), couleur, photo: imageUrl, favori,
        temperature_min: min, temperature_max: max, id_sous_categorie: idSousCategorie };
      if (editingClothing) await updateClothing(editingClothing.id_vetement, payload);
      else await addClothing(payload);
      navigation.goBack();
    } catch (err) {
      setError(err.message || "Le vêtement n’a pas pu être enregistré. Réessaie.");
    } finally { busy.current = false; setSaving(false); }
  };

  const removeClothing = async () => {
    if (busy.current) return;
    busy.current = true; setDeleting(true); setError(null);
    try { await deleteClothing(editingClothing.id_vetement); navigation.goBack(); }
    catch (err) { setError(err.message); }
    finally { busy.current = false; setDeleting(false); }
  };
  const handleDelete = () => {
    const message = `« ${editingClothing.nom} » ne sera plus dans ton dressing.`;
    if (Platform.OS === "web") {
      if (globalThis.confirm(message)) void removeClothing();
    } else Alert.alert("Retirer ce vêtement ?", message, [
      { text: "Annuler", style: "cancel" }, { text: "Retirer", style: "destructive", onPress: removeClothing }
    ]);
  };
  const disabled = saving || deleting;

  return <Screen scroll keyboard edges={["bottom"]}>
    <Heading eyebrow={editingClothing ? "LES DÉTAILS FONT LE STYLE" : "FAIS DE LA PLACE À TES IDÉES"}
      title={editingClothing ? "Ta pièce, en détail." : "Une nouvelle pièce."}
      subtitle="Une photo, quelques détails. Et de nouvelles possibilités." />
    <TouchableOpacity onPress={pickImage} disabled={disabled} accessibilityRole="button"
      accessibilityLabel={photo ? "Changer la photo du vêtement" : "Ajouter une photo"} activeOpacity={0.85}>
      {photo ? <View style={styles.photoBox}>
        <ClothingImage uri={photo} style={styles.photo} />
        <View style={styles.photoCaption}><Ionicons name="camera-outline" size={18} color={COLORS.primary} />
          <Text style={{ ...TYPE.caption, color: COLORS.primary }}>Changer la photo</Text></View>
      </View> : <View style={[styles.photoBox, styles.placeholder]}>
        <View style={styles.camera}><Ionicons name="camera-outline" size={30} color={COLORS.primary} /></View>
        <Text style={TYPE.title}>Commence par une photo</Text>
        <Text style={TYPE.caption}>Choisir dans ma photothèque</Text>
      </View>}
    </TouchableOpacity>

    <View style={layout.card}>
      <Text style={layout.sectionLabel}>01 · L’ESSENTIEL</Text>
      <Field label="Nom du vêtement *" placeholder="Ex. Ma chemise en lin" value={nom} onChangeText={setNom} editable={!disabled} />
      <Field label="Marque" placeholder="Facultatif" value={marque} onChangeText={setMarque} editable={!disabled} />
      <Text style={{ ...TYPE.caption, fontWeight: "600", color: COLORS.text }}>Catégorie *</Text>
      <TouchableOpacity style={[layout.input, layout.between, { flex: 0 }]} disabled={disabled}
        accessibilityRole="button" accessibilityLabel="Choisir une catégorie"
        onPress={() => { setModalVisible(true); setCurrentView("categories"); void loadCatalog(); }}>
        <Text style={[TYPE.body, { flex: 1 }]}>{categoryLabel || (idSousCategorie ? "Catégorie enregistrée · modifier" : "Quel type de pièce ?")}</Text>
        <Ionicons name="chevron-down" size={18} color={COLORS.muted} />
      </TouchableOpacity>
    </View>

    <View style={layout.card}>
      <View style={layout.between}><Text style={layout.sectionLabel}>02 · LA COULEUR *</Text>
        <Text style={{ ...TYPE.caption, textTransform: "capitalize" }}>{couleur || "À choisir"}</Text></View>
      <View style={styles.palette}>
        {Object.entries(CLOTHING_COLORS).map(([name, hex]) => <TouchableOpacity key={name}
          onPress={() => setCouleur(name)} disabled={disabled} accessibilityRole="button"
          accessibilityLabel={`Couleur ${name}`} accessibilityState={{ selected: couleur === name, disabled }}
          style={{ width: "22%", minHeight: 72, alignItems: "center", gap: 7 }}>
          <View style={{ padding: 3, borderRadius: 24, borderWidth: 2, borderColor: couleur === name ? COLORS.primary : "transparent" }}>
            <View style={{ backgroundColor: hex, height: 32, width: 32, borderRadius: 16, borderWidth: 1,
              borderColor: COLORS.border, justifyContent: "center", alignItems: "center" }}>
              {couleur === name ? <Ionicons name="checkmark" size={20} color={["blanc", "jaune", "beige"].includes(name) ? COLORS.text : "#fff"} /> : null}
            </View>
          </View>
          <Text style={{ ...TYPE.caption, fontSize: 12, textTransform: "capitalize" }}>{name}</Text>
        </TouchableOpacity>)}
      </View>
    </View>

    <View style={layout.card}>
      <Text style={layout.sectionLabel}>03 · QUAND LA PORTER ?</Text>
      <View style={layout.row}>
        <Ionicons name={thermalMode === "auto" ? "sparkles-outline" : "options-outline"} size={24} color={COLORS.primary} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={TYPE.body}>{thermalMode === "auto" ? "Estimation automatique" : "Réglage personnalisé"}</Text>
          <Text style={TYPE.caption}>{thermalMode === "auto" ?
            idSousCategorie ? estimatedThermal.label : "Choisis le type de vêtement pour obtenir une estimation." :
            `${thermalMin === "" ? 0 : thermalMin} à ${thermalMax === "" ? 50 : thermalMax} °C · réglage manuel`}</Text>
        </View>
      </View>
      <Text style={TYPE.caption}>Les valeurs sont proposées selon le type de pièce. Un haut peut rester disponible dans le froid pour être porté sous une autre couche.</Text>
      {thermalMode === "auto" && idSousCategorie && estimatedThermal.generic ?
        <Text style={TYPE.caption}>Ce type de pièce est peu précis : l’estimation est large. Tu peux l’ajuster si nécessaire.</Text> : null}
      {showThermalDetails ? <View style={{ flexDirection: "row", gap: 12 }}>
        <Field label="Minimum · °C" placeholder="0" value={tempMin} onChangeText={setTempMin}
          keyboardType="numbers-and-punctuation" style={{ flex: 1 }} editable={!disabled} />
        <Field label="Maximum · °C" placeholder="50" value={tempMax} onChangeText={setTempMax}
          keyboardType="numbers-and-punctuation" style={{ flex: 1 }} editable={!disabled} />
      </View> : null}
      {!showThermalDetails ? <Button title="Ajuster les températures" variant="secondary" disabled={disabled}
        onPress={() => {
          if (thermalMode === "auto") { setTempMin(String(thermalMin)); setTempMax(String(thermalMax)); }
          setThermalMode("manual"); setShowThermalDetails(true);
        }} /> : <Text style={TYPE.caption}>Réglage avancé facultatif. Champs vides : de 0 à 50 °C.</Text>}
      {showThermalDetails ? <Text style={TYPE.caption}>Ces bornes servent à sélectionner les pièces. Elles ne décrivent pas le confort du vêtement porté seul ; la tenue peut comporter plusieurs couches.</Text> : null}
      {thermalMode === "manual" ? <Button title="Utiliser l’estimation automatique" variant="secondary" disabled={disabled}
        onPress={() => { setThermalMode("auto"); setShowThermalDetails(false); }} /> : null}
      <View style={layout.divider} />
      <View style={layout.between}>
        <View style={{ flex: 1, gap: 4 }}><Text style={TYPE.body}>Une de tes favorites ?</Text><Text style={TYPE.caption}>Retrouve-la facilement dans le dressing.</Text></View>
        <Switch value={favori} onValueChange={setFavori} disabled={disabled} accessibilityLabel="Vêtement favori"
          trackColor={{ false: COLORS.border, true: COLORS.primary }} />
      </View>
    </View>
    {error ? <Notice error message={error} /> : null}
    <Button title={saving ? "Enregistrement…" : editingClothing ? "Enregistrer les modifications" : "Ajouter à mon dressing"}
      icon="checkmark-outline" loading={saving} disabled={disabled} onPress={handleSubmit} />
    {editingClothing ? <Button title="Retirer du dressing" icon="trash-outline" variant="danger"
      loading={deleting} disabled={disabled} onPress={handleDelete} /> : null}
    <Sheet visible={modalVisible} title={currentView === "categories" ? "Quel type de pièce ?" : "Plus précisément…"}
      subtitle="Choisis la catégorie qui décrit ton vêtement." onClose={closeCatalog}>
      {catalogLoading ? <ActivityIndicator color={COLORS.primary} /> : catalogError ?
        <View style={{ gap: 12 }}><Notice error message={catalogError} /><Button title="Réessayer" onPress={() => loadCatalog()} /></View> : <>
          {currentView === "sousCategories" ? <Button title="Toutes les catégories" variant="secondary" icon="arrow-back"
            onPress={() => setCurrentView("categories")} /> : null}
          {(currentView === "categories" ? categories : sousCategories).map(item => {
            const id = item.id_sous_categorie || item.id_categorie;
            const label = item.nom_sous_categorie || item.nom_categorie;
            return <TouchableOpacity key={id} style={[layout.between, styles.category]} accessibilityRole="button" accessibilityLabel={`Choisir ${label}`}
              onPress={() => {
                if (currentView === "categories") void loadCatalog(item.id_categorie);
                else { setIdSousCategorie(item.id_sous_categorie); setCategoryLabel(label); closeCatalog(); }
              }}>
              <Text style={[TYPE.body, { flex: 1 }]}>{label}</Text>
              <Ionicons name={item.id_sous_categorie === idSousCategorie ? "checkmark-circle" : "chevron-forward"} size={20} color={COLORS.primary} />
            </TouchableOpacity>;
          })}
          {currentView === "sousCategories" && !sousCategories.length ? <Text style={TYPE.caption}>Aucune sous-catégorie disponible.</Text> : null}
        </>}
    </Sheet>
  </Screen>;
}

const styles = {
  photoBox: { backgroundColor: COLORS.soft, borderRadius: 26, overflow: "hidden" },
  photo: { width: "100%", height: 280 },
  photoCaption: { ...layout.row, padding: 14, justifyContent: "center", backgroundColor: COLORS.card },
  placeholder: { height: 230, alignItems: "center", justifyContent: "center", gap: 12, borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed" },
  camera: { width: 66, height: 66, borderRadius: 24, backgroundColor: COLORS.card, alignItems: "center", justifyContent: "center" },
  palette: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 },
  category: { backgroundColor: COLORS.card, padding: 18, borderRadius: 16, minHeight: 60 }
};
