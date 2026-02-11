import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity
} from "react-native";
import { useEffect, useState } from "react";
import { getMyDressing } from "../services/api";

export default function Dressing({ navigation }) {
  const [dressing, setDressing] = useState([]);

const loadDressing = async () => {
  try {
    const data = await getMyDressing();
    setDressing(data.vetements);
  } catch (error) {
    console.error(error);
  }
};


  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", loadDressing);
    return unsubscribe;
  }, [navigation]);

  const renderItem = ({ item }) => (
    <View style={card}>
      {item.photo ? (
        <Image
          source={{ uri: item.photo }}
          style={image}
        />
      ) : (
        <View style={[image, placeholder]}>
          <Text>📸</Text>
        </View>
      )}

      <Text style={name}>{item.nom}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, padding: 10 }}>
      <FlatList
        data={dressing}
        keyExtractor={(item) => item.id_vetement.toString()}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: "space-between" }}
      />

      {/* Bouton + */}
      <TouchableOpacity
        style={fab}
        onPress={() =>
          navigation.navigate("Dressing", { screen: "AddClothing" })
        }
      >
        <Text style={{ color: "white", fontSize: 24 }}>+</Text>
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
