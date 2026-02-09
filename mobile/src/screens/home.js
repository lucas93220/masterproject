import { View, Text, Button } from "react-native";

export default function Home({ navigation }) {
  return (
    <View>
      <Text>Home Screen</Text>

      <Button
        title="Voir le profil"
        onPress={() => navigation.navigate("Profile")}
      />
    </View>
  );
}
