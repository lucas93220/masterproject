import AppNavigator from "./src/navigation/app";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

export default function App() {
  return <SafeAreaProvider><StatusBar style="dark" /><AppNavigator /></SafeAreaProvider>;
}
