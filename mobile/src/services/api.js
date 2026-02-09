import AsyncStorage from "@react-native-async-storage/async-storage";
const API_URL = "http://localhost:3002/api";

export async function loginUser(email, password) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    throw new Error("Erreur de connexion");
  }

  return response.json();
}

export async function registerUser(userData) {
  const response = await fetch("http://localhost:3002/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(userData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Erreur inscription");
  }

  return response.json();
}

export async function getProfile() {
  const token = await AsyncStorage.getItem("token");

  const response = await fetch("http://localhost:3002/api/utilisateur/me", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error("Impossible de récupérer le profil");
  }

  return response.json();
}

export async function getWeatherForMe() {
  const token = await AsyncStorage.getItem("token");

  const response = await fetch("http://localhost:3002/api/meteo/me", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Erreur météo");
  }

  return response.json();
}
