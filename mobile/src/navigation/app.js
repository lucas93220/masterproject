import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Login from "../screens/login";
import Register from "../screens/register";
import TabNavigator from "./tabNavigator";
import { COLORS } from "../styles/colors";

const Stack = createNativeStackNavigator();
const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors,
  primary: COLORS.primary, background: COLORS.background, card: COLORS.background,
  text: COLORS.text, border: COLORS.border, notification: COLORS.danger
} };

export default function AppNavigator() {
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator>
        <Stack.Screen
          name="Login"
          component={Login}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Register"
          component={Register}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Main"
          component={TabNavigator}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
