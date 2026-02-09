import { View, Text, Button } from "react-native";
import { logout } from "../services/auth";

export default function Profile({ navigation }) {

  const handleLogout = async () => {
    await logout();
    navigation.replace("Login");
  };

  return (
    <View>
      <Text>Profile Screen</Text>

      <Button title="Se déconnecter" onPress={handleLogout} />
    </View>
  );
}
