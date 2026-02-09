import { View, Text, Button } from "react-native";

export default function Register({ navigation }) {
  return (
    <View>
      <Text>Register Screen</Text>

      <Button
        title="Retour Login"
        onPress={() => navigation.goBack()}
      />
    </View>
  );
}
