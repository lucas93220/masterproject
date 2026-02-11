import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Dressing from "../screens/dressing";
import AddClothing from "../screens/addClothing";

const Stack = createNativeStackNavigator();

export default function DressingStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="DressingMain"
        component={Dressing}
        options={{ title: "Dressing" }}
      />
      <Stack.Screen
        name="AddClothing"
        component={AddClothing}
        options={{ title: "Ajouter un vêtement" }}
      />
    </Stack.Navigator>
  );
}
