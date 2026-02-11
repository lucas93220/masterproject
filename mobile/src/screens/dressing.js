import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  Alert
} from "react-native";
import { useEffect, useState } from "react";
import {
  getMyDressing,
  deleteClothing,
  toggleFavorite
} from "../services/api";


export default function Dressing({ navigation }) {
  const [dressing, setDressing] = useState([]);

  const loadDressing = async () => {
    try {
      const data = await getMyDressing();
      setDressing(data.vetements.sort((a, b) => b.favori - a.favori));
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
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
              loadDressing(); // 🔥 refresh
            } catch (error) {
              Alert.alert("Erreur", error.message);
            }
          }
        }
      ]
    );
  };

const renderItem = ({ item }) => (
  <TouchableOpacity
    style={card}
    onPress={() =>
      navigation.navigate("AddClothing", { clothing: item })
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
      <FlatList
        data={dressing}
        keyExtractor={(item) =>
          item.id_vetement.toString()
        }
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={{
          justifyContent: "space-between"
        }}
      />

      <TouchableOpacity
        style={fab}
        onPress={() =>
          navigation.navigate("AddClothing")
        }
      >
        <Text
          style={{ color: "white", fontSize: 24 }}
        >
          +
        </Text>
      </TouchableOpacity>
    </View>
  );
}

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
