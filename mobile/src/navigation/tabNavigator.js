import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Home from "../screens/home";
import Profile from "../screens/profile";
import DressingStack from "./DressingStack";

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={Home} />
      <Tab.Screen name="Dressing" component={DressingStack} />
      <Tab.Screen name="Profile" component={Profile} />
    </Tab.Navigator>
  );
}
