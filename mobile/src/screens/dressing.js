import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  Modal,
  SafeAreaView
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  getMyDressing,
  deleteClothing,
  toggleFavorite,
  getCategories,
  getSousCategoriesByCategorie
} from "../services/api";

import { COLORS } from "../styles/colors";
import { SPACING } from "../styles/spacing";
import { BUTTON_PRIMARY, BUTTON_TEXT } from "../styles/components";

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

  const filteredDressing = selectedCategory
    ? dressing.filter(item =>
        categorySousCategories.some(
          sc => sc.id_sous_categorie === item.id_sous_categorie
        )
      )
    : dressing;

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        navigation.navigate("AddClothing", {
          clothing: item
        })
      }
      onLongPress={() =>
        handleDelete(item.id_vetement)
      }
    >
      <View style={styles.imageContainer}>

        {item.photo ? (
          <Image source={{ uri: item.photo }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Text>📸</Text>
          </View>
        )}

        {/* ❤️ Like overlay */}
        <TouchableOpacity
          onPress={() => handleToggleFavorite(item)}
          style={styles.heartContainer}
        >
          <Ionicons
            name={item.favori ? "heart" : "heart-outline"}
            size={20}
            color={item.favori ? "#E53935" : "#ffffffff"}
          />
        </TouchableOpacity>

      </View>

      <Text style={styles.name}>
        {item.nom}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.title}>Mon Dressing</Text>

        <TouchableOpacity
          onPress={() => setFilterModal(true)}
          style={styles.filterButton}
        >
          <Text style={styles.filterText}>Filtrer</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        contentContainerStyle={{ padding: SPACING.md }}
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

      {/* MODAL */}
      <Modal visible={filterModal} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>

          <Text style={styles.modalTitle}>
            Choisir une catégorie
          </Text>

          <TouchableOpacity
            style={styles.modalItem}
            onPress={() => {
              setSelectedCategory(null);
              setFilterModal(false);
            }}
          >
            <Text>Tout</Text>
          </TouchableOpacity>

          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id_categorie}
              style={styles.modalItem}
              onPress={() => handleSelectCategory(cat.id_categorie)}
            >
              <Text>{cat.nom_categorie}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[BUTTON_PRIMARY, { marginTop: SPACING.lg }]}
            onPress={() => setFilterModal(false)}
          >
            <Text style={BUTTON_TEXT}>Fermer</Text>
          </TouchableOpacity>

        </SafeAreaView>
      </Modal>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() =>
          navigation.navigate("AddClothing")
        }
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

    </SafeAreaView>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm
  },

  title: {
    fontSize: 22,
    fontWeight: "600",
    color: COLORS.text
  },

  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border
  },

  filterText: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.text
  },

  card: {
    width: "48%",
    marginBottom: 20
  },

  imageContainer: {
    position: "relative"
  },

  image: {
    width: "100%",
    height: 160,
    borderRadius: 16
  },

  placeholder: {
    backgroundColor: "#eee",
    justifyContent: "center",
    alignItems: "center"
  },

  heartContainer: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.50,
    shadowRadius: 4,
    elevation: 3
  },

  name: {
    marginTop: 8,
    fontWeight: "500",
    fontSize: 14
  },

  modalContainer: {
    flex: 1,
    padding: SPACING.lg,
    backgroundColor: COLORS.background
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: SPACING.lg
  },

  modalItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },

  fab: {
    position: "absolute",
    bottom: 25,
    right: 25,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6
  },

  fabText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "600"
  }
};