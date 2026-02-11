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
import { addClothing, getCategories } from "../services/api";

export default function AddClothing({ navigation }) {
  const [photo, setPhoto] = useState(null);
  const [nom, setNom] = useState("");
  const [marque, setMarque] = useState("");
  const [couleur, setCouleur] = useState("");
  const [categories, setCategories] = useState([]);
  const [idCategorie, setIdCategorie] = useState(null);
  const [tempMin, setTempMin] = useState("");
  const [tempMax, setTempMax] = useState("");
  const [favori, setFavori] = useState(false);
  const [categoryModal, setCategoryModal] = useState(false);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => {
        Alert.alert("Erreur", "Impossible de charger les catégories");
      });
  }, []);

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
    if (!nom || !idCategorie) {
      Alert.alert("Erreur", "Nom et catégorie obligatoires");
      return;
    }

    try {
      await addClothing({
        nom,
        marque,
        couleur,
        photo,
        favori,
        temperature_min: tempMin ? Number(tempMin) : null,
        temperature_max: tempMax ? Number(tempMax) : null,
        id_categorie: idCategorie
      });

      Alert.alert("Succès", "Vêtement ajouté");
      navigation.goBack();
    } catch (e) {
      Alert.alert("Erreur", e.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <Text style={title}>Ajouter un vêtement</Text>

      {/* PHOTO */}
      <TouchableOpacity onPress={pickImage}>
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={image}
          />
        ) : (
          <View style={imagePlaceholder}>
            <Text>📸 Ajouter une photo</Text>
          </View>
        )}
      </TouchableOpacity>

      <TextInput
        placeholder="Nom"
        value={nom}
        onChangeText={setNom}
        style={input}
      />

      <TextInput
        placeholder="Marque"
        value={marque}
        onChangeText={setMarque}
        style={input}
      />

      <TextInput
        placeholder="Couleur"
        value={couleur}
        onChangeText={setCouleur}
        style={input}
      />

      {/* CATÉGORIE */}
      <TouchableOpacity
        style={input}
        onPress={() => setCategoryModal(true)}
      >
        <Text style={{ color: idCategorie ? "#000" : "#999" }}>
          {idCategorie
            ? categories.find(c => c.id_categorie === idCategorie)?.nom_categorie
            : "Choisir une catégorie"}
        </Text>
      </TouchableOpacity>

      <TextInput
        placeholder="Température min (°C)"
        keyboardType="numeric"
        value={tempMin}
        onChangeText={setTempMin}
        style={input}
      />

      <TextInput
        placeholder="Température max (°C)"
        keyboardType="numeric"
        value={tempMax}
        onChangeText={setTempMax}
        style={input}
      />

      {/* FAVORI */}
      <View style={favoriRow}>
        <Text>Favori</Text>
        <Switch value={favori} onValueChange={setFavori} />
      </View>

      <Button title="Ajouter le vêtement" onPress={handleSubmit} />

      {/* MODAL CATÉGORIES */}
      <Modal visible={categoryModal} animationType="slide">
        <View style={{ flex: 1, padding: 20 }}>
          <Text style={title}>Choisir une catégorie</Text>

          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id_categorie}
              style={categoryItem}
              onPress={() => {
                setIdCategorie(cat.id_categorie);
                setCategoryModal(false);
              }}
            >
              <Text style={{ fontSize: 16 }}>
                {cat.nom_categorie}
              </Text>
            </TouchableOpacity>
          ))}

          <Button title="Annuler" onPress={() => setCategoryModal(false)} />
        </View>
      </Modal>
    </ScrollView>
  );
}

/* ===== STYLES ===== */

const title = {
  fontSize: 22,
  marginBottom: 15
};

const input = {
  borderWidth: 1,
  borderColor: "#ccc",
  padding: 12,
  marginBottom: 10,
  borderRadius: 6
};

const image = {
  width: "100%",
  height: 200,
  borderRadius: 10,
  marginBottom: 10
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
  alignItems: "center",
  marginVertical: 10
};

const categoryItem = {
  paddingVertical: 15,
  borderBottomWidth: 1,
  borderBottomColor: "#eee"
};
