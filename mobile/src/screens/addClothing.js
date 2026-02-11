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
  getCategories
} from "../services/api";

export default function AddClothing({ navigation, route }) {
  const editingClothing = route?.params?.clothing;

  const [photo, setPhoto] = useState(editingClothing?.photo || null);
  const [nom, setNom] = useState(editingClothing?.nom || "");
  const [marque, setMarque] = useState(editingClothing?.marque || "");
  const [couleur, setCouleur] = useState(editingClothing?.couleur || "");
  const [categories, setCategories] = useState([]);
  const [idCategorie, setIdCategorie] = useState(
    editingClothing?.id_categorie || null
  );
  const [tempMin, setTempMin] = useState(
    editingClothing?.temperature_min
      ? editingClothing.temperature_min.toString()
      : ""
  );
  const [tempMax, setTempMax] = useState(
    editingClothing?.temperature_max
      ? editingClothing.temperature_max.toString()
      : ""
  );
  const [favori, setFavori] = useState(
    editingClothing?.favori || false
  );
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

    const payload = {
      nom,
      marque,
      couleur,
      photo,
      favori,
      temperature_min: tempMin ? Number(tempMin) : null,
      temperature_max: tempMax ? Number(tempMax) : null,
      id_categorie: idCategorie
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
    } catch (e) {
      Alert.alert("Erreur", e.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <Text style={{ fontSize: 22, marginBottom: 15 }}>
        {editingClothing
          ? "Modifier le vêtement"
          : "Ajouter un vêtement"}
      </Text>

      <TouchableOpacity onPress={pickImage}>
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={{
              width: "100%",
              height: 200,
              borderRadius: 10,
              marginBottom: 10
            }}
          />
        ) : (
          <View
            style={{
              height: 200,
              backgroundColor: "#eee",
              borderRadius: 10,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 10
            }}
          >
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

      <TouchableOpacity
        style={input}
        onPress={() => setCategoryModal(true)}
      >
        <Text>
          {idCategorie
            ? categories.find(
                c => c.id_categorie === idCategorie
              )?.nom_categorie
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

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginVertical: 10
        }}
      >
        <Text>Favori</Text>
        <Switch value={favori} onValueChange={setFavori} />
      </View>

      <Button
        title={
          editingClothing ? "Enregistrer" : "Ajouter"
        }
        onPress={handleSubmit}
      />

      <Modal visible={categoryModal} animationType="slide">
        <View style={{ flex: 1, padding: 20 }}>
          <Text style={{ fontSize: 22, marginBottom: 15 }}>
            Choisir une catégorie
          </Text>

          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id_categorie}
              style={{
                paddingVertical: 15,
                borderBottomWidth: 1,
                borderBottomColor: "#eee"
              }}
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

          <Button
            title="Annuler"
            onPress={() => setCategoryModal(false)}
          />
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
