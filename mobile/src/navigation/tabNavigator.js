import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Home from "../screens/home";
import Profile from "../screens/profile";
import DressingStack from "./DressingStack";
import { COLORS } from "../styles/colors";

const Tab = createBottomTabNavigator();
const icons = { Home: ["sunny-outline", "sunny"], Dressing: ["shirt-outline", "shirt"], Profile: ["person-outline", "person"] };

export default function TabNavigator() {
  const insets = useSafeAreaInsets();
  return <Tab.Navigator screenOptions={({ route }) => ({
    headerShown: false,
    tabBarActiveTintColor: COLORS.primary,
    tabBarInactiveTintColor: COLORS.muted,
    tabBarStyle: { backgroundColor: COLORS.background, borderTopColor: COLORS.border,
      height: 72 + insets.bottom, paddingBottom: Math.max(insets.bottom, 4), paddingTop: 4 },
    tabBarLabelStyle: { fontSize: 11, lineHeight: 16, fontWeight: "600" },
    tabBarIcon: ({ focused, color, size }) => <Ionicons name={icons[route.name][focused ? 1 : 0]} size={size - 2} color={color} />,
    tabBarHideOnKeyboard: true
  })}>
    <Tab.Screen name="Home" component={Home} options={{ title: "Aujourd’hui", tabBarAccessibilityLabel: "Aujourd’hui" }} />
    <Tab.Screen name="Dressing" component={DressingStack} options={{ title: "Dressing", tabBarAccessibilityLabel: "Dressing" }} />
    <Tab.Screen name="Profile" component={Profile} options={{ title: "Profil", tabBarAccessibilityLabel: "Profil" }} />
  </Tab.Navigator>;
}
