import AsyncStorage from "@react-native-async-storage/async-storage";

export async function getToken() {
  return AsyncStorage.getItem("token");
}

export async function logout() {
  await AsyncStorage.removeItem("token");
}
