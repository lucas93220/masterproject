import { View, Text, Alert, Switch, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { addClothing, updateClothing, deleteClothing, getCategories, getSousCategoriesByCategorie, uploadImage, analyzeClothingImage, getWardrobeOptions } from "../services/api";
import ClothingImage from "../components/ClothingImage";
import BrandSelect from "../components/BrandSelect";
import { Screen, Button, Field, Sheet, Notice, layout } from "../components/ui";
import { COLORS } from "../styles/colors";
import { CLOTHING_COLORS, LEGACY_COLOR_NAMES } from "../styles/clothingPalette";
import { TYPE } from "../styles/theme";
import { thermalDefaults } from "../services/thermalDefaults";

export default function AddClothing({ navigation, route }) {
  const editingClothing = route?.params?.clothing || null;
  const [photo, setPhoto] = useState(editingClothing?.photo || null);
  const [pickedImage, setPickedImage] = useState(null);
  const [nom, setNom] = useState(editingClothing?.nom || "");
  const [marque, setMarque] = useState(editingClothing?.marque || "");
  const [couleur, setCouleur] = useState(editingClothing?.couleur || "");
  const [secondaryColor, setSecondaryColor] = useState(editingClothing?.couleur_secondaire || "");
  const [colorMessage, setColorMessage] = useState(null);
  const [options, setOptions] = useState(null);
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
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const [analysisMessage, setAnalysisMessage] = useState(null);
  const [visualSearch, setVisualSearch] = useState(null);
  // Une reconnaissance ne remplace jamais une saisie manuelle ou une fiche existante.
  const manualFields = useRef(new Set(editingClothing ? [
    editingClothing.nom && 'nom', editingClothing.marque && 'marque',
    editingClothing.couleur && 'couleur', editingClothing.couleur_secondaire && 'couleur_secondaire', editingClothing.id_sous_categorie && 'category'
  ].filter(Boolean) : []));
  const analysisRequest = useRef(0);
  const pickerBusy = useRef(false);
  const mounted = useRef(true);
  const busy = useRef(false);
  const catalogRequest = useRef(0);
  const optionsRequest = useRef(0);
  const uploaded = useRef(null);
  const estimatedThermal = thermalDefaults(categoryLabel);
  const thermalMin = thermalMode === "auto" ? estimatedThermal.min : tempMin;
  const thermalMax = thermalMode === "auto" ? estimatedThermal.max : tempMax;

  useEffect(() => {
    mounted.current = true;
    const refreshOptions = () => {
      if (!getWardrobeOptions) return;
      const request = ++optionsRequest.current;
      return getWardrobeOptions().then(data => {
        if (mounted.current && request === optionsRequest.current) setOptions(data);
      }).catch(() => {});
    };
    void refreshOptions();
    const unsubscribe = navigation.addListener?.("focus", refreshOptions);
    return () => {
      mounted.current = false; optionsRequest.current += 1;
      catalogRequest.current += 1; analysisRequest.current += 1;
      unsubscribe?.();
    };
  }, [navigation]);

  const selectColor = name => {
    if (disabled) return;
    if (options?.max_colors !== 2) {
      manualFields.current.add('couleur'); setCouleur(name); return;
    }
    if (name !== couleur && name !== secondaryColor && couleur && secondaryColor) {
      setColorMessage('Deux couleurs maximum. Touche une couleur sélectionnée pour la retirer.');
      return;
    }
    manualFields.current.add('couleur'); manualFields.current.add('couleur_secondaire');
    setColorMessage(null);
    if (name === couleur) { setCouleur(secondaryColor); setSecondaryColor(''); }
    else if (name === secondaryColor) setSecondaryColor('');
    else if (!couleur) setCouleur(name);
    else setSecondaryColor(name);
  };

  const loadCatalog = async (categoryId = null) => {
    const request = ++catalogRequest.current;
    // Un catalogue historique déjà ouvert garde ses identifiants numériques.
    if (options?.groups?.length && (!categoryId || typeof categoryId === "string")) {
      setCatalogError(null); setCatalogLoading(false);
      if (categoryId) { setSousCategories(options.groups.find(group => group.id_categorie === categoryId)?.subcategories || []); setCurrentView("sousCategories"); }
      else { setCategories(options.groups); setCurrentView("categories"); }
      return;
    }
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
    if (busy.current || pickerBusy.current) return;
    pickerBusy.current = true;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
      if (mounted.current && !result.canceled && result.assets?.[0]) {
        setPickedImage(result.assets[0]);
        setPhoto(result.assets[0].uri);
        uploaded.current = null;
        setAnalysisError(null); setAnalysisMessage(null);
        // Retirer les anciennes suggestions si une autre photo est sélectionnée.
        if (!manualFields.current.has('nom')) setNom('');
        if (!manualFields.current.has('marque')) setMarque('');
        if (!manualFields.current.has('couleur')) setCouleur('');
        if (!manualFields.current.has('couleur_secondaire')) setSecondaryColor('');
        if (!manualFields.current.has('category')) { setIdSousCategorie(null); setCategoryLabel(''); }
        await analyzePhoto(result.assets[0], {
          primary: manualFields.current.has('couleur') ? couleur : '',
          secondary: manualFields.current.has('couleur_secondaire') ? secondaryColor : ''
        });
      }
    } catch {
      if (mounted.current) setError("Impossible d’ouvrir les photos. Vérifie l’accès à ta photothèque dans les réglages.");
    } finally { pickerBusy.current = false; }
  };

  const analyzePhoto = async (image = pickedImage, currentColors = { primary: couleur, secondary: secondaryColor }) => {
    if (busy.current || !image || !mounted.current) return;
    busy.current = true;
    const request = ++analysisRequest.current;
    setAnalyzing(true); setAnalysisError(null); setAnalysisMessage(null);
    setVisualSearch(null);
    try {
      const suggestion = await analyzeClothingImage(image.uri, image.mimeType);
      if (request !== analysisRequest.current) return;
      setVisualSearch(suggestion.visual_search || null);
      let applied = 0;
      for (const [field, setter] of [['nom', setNom], ['marque', setMarque]]) {
        const value = suggestion[field];
        if (!manualFields.current.has(field) && typeof value === 'string' && value.trim()) {
          setter(value); applied += 1;
        }
      }
      // Valider la paire finale : une couleur principale conservée manuellement
      // peut être la secondaire renvoyée par l'analyse.
      let primary = currentColors.primary;
      if (!manualFields.current.has('couleur') && Object.hasOwn(CLOTHING_COLORS, suggestion.couleur)) {
        primary = suggestion.couleur; setCouleur(primary); applied += 1;
      }
      if (!manualFields.current.has('couleur_secondaire')) {
        const secondary = suggestion.couleur_secondaire;
        setSecondaryColor(Object.hasOwn(CLOTHING_COLORS, secondary) && secondary !== primary ? secondary : '');
      }
      if (!manualFields.current.has('category') && Number.isSafeInteger(suggestion.id_sous_categorie) &&
          suggestion.id_sous_categorie > 0 && suggestion.nom_sous_categorie) {
        setIdSousCategorie(suggestion.id_sous_categorie);
        setCategoryLabel(suggestion.nom_sous_categorie); applied += 1;
      }
      setAnalysisMessage(applied ? 'Champs préremplis. Vérifie les informations.' : 'Tes informations ont été conservées.');
    } catch (err) {
      if (request === analysisRequest.current) setAnalysisError(err.message || 'Impossible d’analyser la photo. Tu peux continuer manuellement.');
    } finally {
      busy.current = false;
      if (request === analysisRequest.current) setAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    if (busy.current) return;
    if (!nom.trim() || !idSousCategorie) { setError("Ajoute un nom et choisis une catégorie de vêtement."); return; }
    if (!Object.keys(CLOTHING_COLORS).includes(couleur)) { setError("Choisis une couleur dans la palette."); return; }
    if (secondaryColor && secondaryColor === couleur) { setError("Choisis deux couleurs différentes."); return; }
    if (secondaryColor && options?.max_colors !== 2) { setError("Impossible de vérifier les deux couleurs. Rouvre le formulaire avec une connexion disponible."); return; }
    const min = thermalMode === "auto" ? thermalMin : tempMin.trim() ? Number(tempMin.replace(",", ".")) : 0;
    const max = thermalMode === "auto" ? thermalMax : tempMax.trim() ? Number(tempMax.replace(",", ".")) : 50;
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < -2147483648 || max > 2147483647 || min > max) {
      setError("Indique des températures valides : des nombres entiers, avec un minimum inférieur ou égal au maximum."); return;
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
      const payload = { ...(options?.max_colors === 2 ? { couleur_secondaire: secondaryColor || null } : {}), nom: nom.trim(), marque: marque.trim(), couleur, photo: imageUrl, favori,
        temperature_min: min, temperature_max: max, id_sous_categorie: idSousCategorie };
      if (editingClothing) await updateClothing(editingClothing.id_vetement, payload);
      else await addClothing(payload);
      if (mounted.current) navigation.goBack();
    } catch (err) {
      if (mounted.current) setError(err.message || "Le vêtement n’a pas pu être enregistré. Réessaie.");
    } finally { busy.current = false; if (mounted.current) setSaving(false); }
  };

  const removeClothing = async () => {
    if (busy.current) return;
    busy.current = true; setDeleting(true); setError(null);
    try { await deleteClothing(editingClothing.id_vetement); if (mounted.current) navigation.goBack(); }
    catch (err) { if (mounted.current) setError(err.message); }
    finally { busy.current = false; if (mounted.current) setDeleting(false); }
  };
  const handleDelete = () => {
    const message = `« ${editingClothing.nom} » ne sera plus dans ton dressing ni proposé dans de nouvelles tenues. Ses anciennes tenues et évaluations restent enregistrées jusqu'à la suppression de ton compte.`;
    if (Platform.OS === "web") {
      if (globalThis.confirm(message)) void removeClothing();
    } else Alert.alert("Retirer ce vêtement ?", message, [
      { text: "Annuler", style: "cancel" }, { text: "Retirer", style: "destructive", onPress: removeClothing }
    ]);
  };
  const disabled = saving || deleting || analyzing;

  return <Screen scroll keyboard edges={["bottom"]}>
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

    {analyzing ? <View style={layout.row} accessibilityLiveRegion="polite">
      <ActivityIndicator color={COLORS.primary} /><Text style={TYPE.caption}>Préremplissage en cours…</Text>
    </View> : null}
    {analysisError ? <View style={{ gap: 10 }}>
      <Notice error message={analysisError} />
      <Button title="Réessayer l’analyse" variant="secondary" disabled={disabled} onPress={() => analyzePhoto()} />
    </View> : null}
    <Text style={TYPE.caption}>La photo est analysée par Google Gemini. Une recherche visuelle via SerpApi peut compléter l’identification.</Text>
    {analysisMessage ? <Notice message={analysisMessage} /> : null}
    {visualSearch?.status === 'unavailable' ? <Notice message="Recherche visuelle indisponible. Le préremplissage photo reste disponible." /> : null}
    {visualSearch?.status === 'no_matches' ? <Text style={TYPE.caption}>Aucune correspondance visuelle trouvée. Les champs restent modifiables.</Text> : null}


    <View style={layout.card}>
      <Text style={layout.sectionLabel}>01 · L’ESSENTIEL</Text>
      <Field label="Nom du vêtement *" placeholder="Ex. Ma chemise en lin" value={nom}
        onChangeText={value => { manualFields.current.add('nom'); setNom(value); }} editable={!disabled} />
      <BrandSelect value={marque} onChange={value => { manualFields.current.add('marque'); setMarque(value); }} disabled={disabled} />
      <Text style={{ ...TYPE.caption, fontWeight: "600", color: COLORS.text }}>Catégorie *</Text>
      <TouchableOpacity style={[layout.input, layout.between, { flex: 0 }]} disabled={disabled}
        accessibilityRole="button" accessibilityLabel="Choisir une catégorie"
        onPress={() => { setModalVisible(true); setCurrentView("categories"); void loadCatalog(); }}>
        <Text style={[TYPE.body, { flex: 1 }]}>{categoryLabel || (idSousCategorie ? "Catégorie enregistrée · modifier" : "Quel type de pièce ?")}</Text>
        <Ionicons name="chevron-down" size={18} color={COLORS.muted} />
      </TouchableOpacity>
    </View>

    <View style={layout.card}>
      <View style={layout.between}><Text style={layout.sectionLabel}>02 · LES COULEURS</Text>
        <Text style={{ ...TYPE.caption, textTransform: "capitalize" }}>{[couleur, secondaryColor].filter(Boolean).join(" · ") || "À choisir"}</Text></View>
      {options?.max_colors === 2 ? <>
        {colorMessage ? <Notice message={colorMessage} /> : null}
        {secondaryColor ? <Button title="Retirer la seconde couleur" variant="secondary" disabled={disabled}
          onPress={() => { manualFields.current.add('couleur_secondaire'); setSecondaryColor(''); setColorMessage(null); }} /> : null}
      </> : null}
      <View style={styles.palette}>
        {Object.entries(CLOTHING_COLORS).filter(([name]) => (options?.colors || LEGACY_COLOR_NAMES).includes(name)).map(([name, hex]) => <TouchableOpacity key={name}
          onPress={() => selectColor(name)} disabled={disabled} accessibilityRole="button"
          accessibilityLabel={`Couleur ${name}`}
          {...(Platform.OS === "web" ? { "aria-pressed": couleur === name || secondaryColor === name } : {})}
          accessibilityState={{ selected: (couleur === name || secondaryColor === name), disabled }}
          style={{ width: "22%", minHeight: 72, alignItems: "center", gap: 7 }}>
          <View style={{ padding: 3, borderRadius: 24, borderWidth: 2, borderColor: (couleur === name || secondaryColor === name) ? COLORS.primary : "transparent" }}>
            <View style={{ backgroundColor: hex, height: 32, width: 32, borderRadius: 16, borderWidth: 1,
              borderColor: COLORS.border, justifyContent: "center", alignItems: "center" }}>
              {(couleur === name || secondaryColor === name) ? <Text style={{ fontWeight: "700", color: ["blanc", "jaune", "beige", "écru", "argenté", "doré"].includes(name) ? COLORS.text : "#fff" }}>{couleur === name ? "1" : "2"}</Text> : null}
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
                else { manualFields.current.add('category'); setIdSousCategorie(item.id_sous_categorie); setCategoryLabel(label); closeCatalog(); }
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
  palette: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-start", gap: 8 },
  category: { backgroundColor: COLORS.card, padding: 18, borderRadius: 16, minHeight: 60 }
};
