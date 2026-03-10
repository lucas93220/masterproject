import {
  View,
  Text,
  TextInput,
  Alert,
  ScrollView,
  Image,
  Switch,
  TouchableOpacity,
  Modal,
  SafeAreaView
} from "react-native";
import { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  addClothing,
  updateClothing,
  getCategories,
  getSousCategoriesByCategorie
} from "../services/api";

import { COLORS } from "../styles/colors";
import { SPACING } from "../styles/spacing";
import { CARD, BUTTON_PRIMARY, BUTTON_TEXT } from "../styles/components";

export default function AddClothing({ navigation, route }) {
  const editingClothing = route?.params?.clothing || null;

  const [photo, setPhoto] = useState(editingClothing?.photo || null);
  const [nom, setNom] = useState(editingClothing?.nom || "");
  const [marque, setMarque] = useState(editingClothing?.marque || "");
  const [couleur, setCouleur] = useState(editingClothing?.couleur || "");
  const [tempMin, setTempMin] = useState(
    editingClothing?.temperature_min?.toString() || ""
  );
  const [tempMax, setTempMax] = useState(
    editingClothing?.temperature_max?.toString() || ""
  );
  const [favori, setFavori] = useState(editingClothing?.favori || false);

  const [categories, setCategories] = useState([]);
  const [sousCategories, setSousCategories] = useState([]);

  const [idCategorie, setIdCategorie] = useState(null);
  const [idSousCategorie, setIdSousCategorie] = useState(
    editingClothing?.id_sous_categorie || null
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [currentView, setCurrentView] = useState("categories");

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await getCategories();
        setCategories(data);
      } catch {
        Alert.alert("Erreur", "Impossible de charger les catégories");
      }
    };
    loadCategories();
  }, []);

  const loadSousCategories = async (categorieId) => {
    try {
      const data = await getSousCategoriesByCategorie(categorieId);
      setSousCategories(data);
      setCurrentView("sousCategories");
    } catch {
      Alert.alert("Erreur", "Impossible de charger les sous-catégories");
    }
  };

  const handleSelectSousCategorie = (sc) => {
    setIdSousCategorie(sc.id_sous_categorie);
    setModalVisible(false);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7
    });

    if (!result.canceled) {
      setPhoto(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!nom || !idSousCategorie) {
      Alert.alert("Erreur", "Nom et sous-catégorie obligatoires");
      return;
    }

    const payload = {
      nom,
      marque,
      couleur,
      photo,
      favori,
      temperature_min: tempMin ? Number(tempMin) : 0,
      temperature_max: tempMax ? Number(tempMax) : 50,
      id_sous_categorie: idSousCategorie
    };

    try {
      if (editingClothing) {
        await updateClothing(editingClothing.id_vetement, payload);
      } else {
        await addClothing(payload);
      }

      navigation.goBack();
    } catch (error) {
      Alert.alert("Erreur", error.message);
    }
  };

  const selectedSousCategorie = sousCategories.find(
    sc => sc.id_sous_categorie === idSousCategorie
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        <Text style={styles.title}>
          {editingClothing ? "Modifier le vêtement" : "Ajouter un vêtement"}
        </Text>

        {/* PHOTO */}
        <TouchableOpacity onPress={pickImage} style={styles.photoContainer}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text>📸 Ajouter une photo</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* FORM CARD */}
        <View style={CARD}>

          <TextInput
            placeholder="Nom"
            value={nom}
            onChangeText={setNom}
            style={styles.input}
          />

          <TextInput
            placeholder="Marque"
            value={marque}
            onChangeText={setMarque}
            style={styles.input}
          />

          <TextInput
            placeholder="Couleur"
            value={couleur}
            onChangeText={setCouleur}
            style={styles.input}
          />

          <TouchableOpacity
            style={styles.input}
            onPress={() => {
              setCurrentView("categories");
              setModalVisible(true);
            }}
          >
            <Text>
              {selectedSousCategorie
                ? selectedSousCategorie.nom_sous_categorie
                : "Choisir une catégorie"}
            </Text>
          </TouchableOpacity>

          <View style={styles.tempRow}>
            <TextInput
              placeholder="Temp min"
              keyboardType="numeric"
              value={tempMin}
              onChangeText={setTempMin}
              style={[styles.input, styles.tempInput]}
            />

            <TextInput
              placeholder="Temp max"
              keyboardType="numeric"
              value={tempMax}
              onChangeText={setTempMax}
              style={[styles.input, styles.tempInput]}
            />
          </View>

          <View style={styles.favoriRow}>
            <Text>Favori</Text>
            <Switch value={favori} onValueChange={setFavori} />
          </View>

        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          style={[BUTTON_PRIMARY, { marginTop: SPACING.lg }]}
        >
          <Text style={BUTTON_TEXT}>Enregistrer</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* MODAL */}
      <Modal visible={modalVisible} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>

          {currentView === "categories" && (
            <>
              <Text style={styles.modalTitle}>Choisir une catégorie</Text>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id_categorie}
                  style={styles.modalItem}
                  onPress={() => {
                    setIdCategorie(cat.id_categorie);
                    loadSousCategories(cat.id_categorie);
                  }}
                >
                  <Text>{cat.nom_categorie}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          {currentView === "sousCategories" && (
            <>
              <TouchableOpacity
                onPress={() => setCurrentView("categories")}
              >
                <Text style={{ marginBottom: SPACING.md }}>← Retour</Text>
              </TouchableOpacity>

              <Text style={styles.modalTitle}>
                Choisir une sous-catégorie
              </Text>

              {sousCategories.map(sc => (
                <TouchableOpacity
                  key={sc.id_sous_categorie}
                  style={styles.modalItem}
                  onPress={() => handleSelectSousCategorie(sc)}
                >
                  <Text>{sc.nom_sous_categorie}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          <TouchableOpacity
            style={[BUTTON_PRIMARY, { marginTop: SPACING.lg }]}
            onPress={() => setModalVisible(false)}
          >
            <Text style={BUTTON_TEXT}>Fermer</Text>
          </TouchableOpacity>

        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  content: {
    padding: SPACING.md
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: SPACING.md
  },
  photoContainer: {
    marginBottom: SPACING.md
  },
  photo: {
    width: "100%",
    height: 180,
    borderRadius: 16
  },
  photoPlaceholder: {
    height: 180,
    backgroundColor: COLORS.border,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center"
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    borderRadius: 12,
    marginBottom: SPACING.md,
    backgroundColor: "#fff"
  },
  tempRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  tempInput: {
    width: "48%"
  },
  favoriRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  modalContainer: {
    flex: 1,
    padding: SPACING.lg,
    backgroundColor: COLORS.background
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: SPACING.lg
  },
  modalItem: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  }
};