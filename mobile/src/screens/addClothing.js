import {
  View,
  Text,
  TextInput,
  Button,
  Alert,
  ScrollView,
  Image,
  Switch,
  TouchableOpacity,
  Modal
} from "react-native";
import { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  addClothing,
  updateClothing,
  getCategories,
  getSousCategoriesByCategorie
} from "../services/api";

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

  // Charger catégories
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

  // Charger sous-catégories
  const loadSousCategories = async (categorieId) => {
    try {
      const data = await getSousCategoriesByCategorie(categorieId);
      setSousCategories(data);
      setCurrentView("sousCategories");
    } catch {
      Alert.alert("Erreur", "Impossible de charger les sous-catégories");
    }
  };

  // Sélection sous-catégorie
  const handleSelectSousCategorie = (sc) => {
    setIdSousCategorie(sc.id_sous_categorie);
    setModalVisible(false);
  };

  // Image picker
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7
    });

    if (!result.canceled) {
      setPhoto(result.assets[0].uri);
    }
  };

  // Submit
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
        Alert.alert("Succès", "Vêtement modifié");
      } else {
        await addClothing(payload);
        Alert.alert("Succès", "Vêtement ajouté");
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
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <Text style={{ fontSize: 22, marginBottom: 15 }}>
        {editingClothing ? "Modifier le vêtement" : "Ajouter un vêtement"}
      </Text>

      {/* PHOTO */}
      <TouchableOpacity onPress={pickImage}>
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={{ width: "100%", height: 200, borderRadius: 10 }}
          />
        ) : (
          <View style={imagePlaceholder}>
            <Text>📸 Ajouter une photo</Text>
          </View>
        )}
      </TouchableOpacity>

      <TextInput placeholder="Nom" value={nom} onChangeText={setNom} style={input} />
      <TextInput placeholder="Marque" value={marque} onChangeText={setMarque} style={input} />
      <TextInput placeholder="Couleur" value={couleur} onChangeText={setCouleur} style={input} />

      {/* Sélecteur unique */}
      <TouchableOpacity
        style={input}
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

      <TextInput
        placeholder="Température min"
        keyboardType="numeric"
        value={tempMin}
        onChangeText={setTempMin}
        style={input}
      />

      <TextInput
        placeholder="Température max"
        keyboardType="numeric"
        value={tempMax}
        onChangeText={setTempMax}
        style={input}
      />

      <View style={favoriRow}>
        <Text>Favori</Text>
        <Switch value={favori} onValueChange={setFavori} />
      </View>

      <Button title="Enregistrer" onPress={handleSubmit} />

      {/* MODAL UNIQUE */}
      <Modal visible={modalVisible} animationType="slide">
        <View style={{ flex: 1, padding: 20 }}>

          {currentView === "categories" && (
            <>
              <Text style={modalTitle}>Choisir une catégorie</Text>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id_categorie}
                  style={modalItem}
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
              <TouchableOpacity onPress={() => setCurrentView("categories")}>
                <Text style={{ marginBottom: 10 }}>← Retour</Text>
              </TouchableOpacity>

              <Text style={modalTitle}>Choisir une sous-catégorie</Text>

              {sousCategories.map(sc => (
                <TouchableOpacity
                  key={sc.id_sous_categorie}
                  style={modalItem}
                  onPress={() => handleSelectSousCategorie(sc)}
                >
                  <Text>{sc.nom_sous_categorie}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          <Button title="Fermer" onPress={() => setModalVisible(false)} />
        </View>
      </Modal>
    </ScrollView>
  );
}

const input = {
  borderWidth: 1,
  borderColor: "#ccc",
  padding: 12,
  marginBottom: 10,
  borderRadius: 6
};

const imagePlaceholder = {
  height: 200,
  backgroundColor: "#eee",
  borderRadius: 10,
  justifyContent: "center",
  alignItems: "center",
  marginBottom: 10
};

const favoriRow = {
  flexDirection: "row",
  justifyContent: "space-between",
  marginVertical: 10
};

const modalItem = {
  paddingVertical: 15,
  borderBottomWidth: 1,
  borderBottomColor: "#eee"
};

const modalTitle = {
  fontSize: 20,
  marginBottom: 15
};
