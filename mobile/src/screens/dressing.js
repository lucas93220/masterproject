import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  Modal
} from "react-native";
import { useEffect, useState } from "react";
import {
  getMyDressing,
  deleteClothing,
  toggleFavorite,
  getCategories,
  getSousCategoriesByCategorie
} from "../services/api";

export default function Dressing({ navigation }) {
  const [dressing, setDressing] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [filterModal, setFilterModal] = useState(false);

  const [categorySousCategories, setCategorySousCategories] = useState([]);

  const loadDressing = async () => {
    try {
      const data = await getMyDressing();
      setDressing(
        data.vetements.sort((a, b) => b.favori - a.favori)
      );
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(console.error);

    const unsubscribe = navigation.addListener(
      "focus",
      loadDressing
    );
    return unsubscribe;
  }, [navigation]);

  const handleToggleFavorite = async (item) => {
    try {
      await toggleFavorite(item.id_vetement, item.favori);
      loadDressing();
    } catch (error) {
      Alert.alert("Erreur", error.message);
    }
  };

  const handleDelete = (id) => {
    Alert.alert(
      "Supprimer",
      "Voulez-vous supprimer ce vêtement ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteClothing(id);
              loadDressing();
            } catch (error) {
              Alert.alert("Erreur", error.message);
            }
          }
        }
      ]
    );
  };

  const handleSelectCategory = async (categorieId) => {
    try {
      const sousCats = await getSousCategoriesByCategorie(categorieId);
      setCategorySousCategories(sousCats);
      setSelectedCategory(categorieId);
      setFilterModal(false);
    } catch {
      Alert.alert("Erreur", "Impossible de charger les sous-catégories");
    }
  };

  // 🔥 Filtrage basé sur id_sous_categorie
  const filteredDressing = selectedCategory
    ? dressing.filter(item =>
        categorySousCategories.some(
          sc => sc.id_sous_categorie === item.id_sous_categorie
        )
      )
    : dressing;

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={card}
      onPress={() =>
        navigation.navigate("AddClothing", {
          clothing: item
        })
      }
      onLongPress={() =>
        handleDelete(item.id_vetement)
      }
    >
      {item.photo ? (
        <Image source={{ uri: item.photo }} style={image} />
      ) : (
        <View style={[image, placeholder]}>
          <Text>📸</Text>
        </View>
      )}

      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 5 }}>
        <Text style={name}>{item.nom}</Text>

        <TouchableOpacity
          onPress={() => handleToggleFavorite(item)}
          style={{ marginLeft: 6 }}
        >
          <Text style={{ fontSize: 18 }}>
            {item.favori ? "❤️" : "🤍"}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, padding: 10 }}>
      
      {/* Bouton Filtrer */}
      <TouchableOpacity
        style={filterButton}
        onPress={() => setFilterModal(true)}
      >
        <Text style={{ color: "white", textAlign: "center" }}>
          Filtrer par catégorie
        </Text>
      </TouchableOpacity>

      {selectedCategory && (
        <Text style={{ marginBottom: 10 }}>
          Catégorie : {
            categories.find(
              (c) => c.id_categorie === selectedCategory
            )?.nom_categorie
          }
        </Text>
      )}

      <FlatList
        data={filteredDressing}
        keyExtractor={(item) =>
          item.id_vetement.toString()
        }
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={{
          justifyContent: "space-between"
        }}
      />

      {/* Modal catégories */}
      <Modal visible={filterModal} animationType="slide">
        <View style={{ flex: 1, padding: 20 }}>
          <Text style={{ fontSize: 20, marginBottom: 20 }}>
            Choisir une catégorie
          </Text>

          <TouchableOpacity
            style={categoryItem}
            onPress={() => {
              setSelectedCategory(null);
              setFilterModal(false);
            }}
          >
            <Text style={{ fontSize: 16 }}>Tout</Text>
          </TouchableOpacity>

          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id_categorie}
              style={categoryItem}
              onPress={() => handleSelectCategory(cat.id_categorie)}
            >
              <Text style={{ fontSize: 16 }}>
                {cat.nom_categorie}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={closeButton}
            onPress={() => setFilterModal(false)}
          >
            <Text style={{ color: "white", textAlign: "center" }}>
              Fermer
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Bouton + */}
      <TouchableOpacity
        style={fab}
        onPress={() =>
          navigation.navigate("AddClothing")
        }
      >
        <Text style={{ color: "white", fontSize: 24 }}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ===== STYLES ===== */

const card = {
  width: "48%",
  marginBottom: 15,
  alignItems: "center"
};

const image = {
  width: "100%",
  height: 150,
  borderRadius: 10
};

const placeholder = {
  backgroundColor: "#eee",
  justifyContent: "center",
  alignItems: "center"
};

const name = {
  marginTop: 5,
  fontWeight: "500"
};

const fab = {
  position: "absolute",
  bottom: 20,
  right: 20,
  width: 56,
  height: 56,
  borderRadius: 28,
  backgroundColor: "#007AFF",
  alignItems: "center",
  justifyContent: "center",
  elevation: 4
};

const filterButton = {
  padding: 10,
  backgroundColor: "#007AFF",
  borderRadius: 6,
  marginBottom: 10
};

const categoryItem = {
  paddingVertical: 15,
  borderBottomWidth: 1,
  borderBottomColor: "#eee"
};

const closeButton = {
  marginTop: 20,
  padding: 10,
  backgroundColor: "#007AFF",
  borderRadius: 6
};
