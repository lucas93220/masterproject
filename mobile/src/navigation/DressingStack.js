import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Dressing from "../screens/dressing";
import AddClothing from "../screens/addClothing";
import { COLORS } from "../styles/colors";

const Stack = createNativeStackNavigator();
export default function DressingStack() {
  return <Stack.Navigator screenOptions={{
    headerStyle: { backgroundColor: COLORS.background }, headerTintColor: COLORS.primary,
    headerShadowVisible: false, headerBackTitle: "Dressing", headerTitleStyle: { fontSize: 16 }
  }}>
    <Stack.Screen name="DressingMain" component={Dressing} options={{ headerShown: false }} />
    <Stack.Screen name="AddClothing" component={AddClothing}
      options={({ route }) => ({ title: route.params?.clothing ? "Modifier la pièce" : "Ajouter une pièce" })} />
  </Stack.Navigator>;
}
