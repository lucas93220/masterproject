import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "http://localhost:3002/api";


async function apiRequest(endpoint, method = "GET", body = null) {
  const token = await AsyncStorage.getItem("token");

  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : undefined
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, options);

  let data = null;
  try {
    data = await response.json();
  } catch {
    // cas DELETE ou réponse vide
  }

  if (!response.ok) {
    throw new Error(data?.message || "Erreur serveur");
  }

  return data;
}


export function loginUser(email, password) {
  return apiRequest("/auth/login", "POST", { email, password });
}

export function registerUser(userData) {
  return apiRequest("/auth/register", "POST", userData);
}


export function getProfile() {
  return apiRequest("/utilisateur/me");
}

export function updateProfile(profileData) {
  return apiRequest("/utilisateur/me", "PUT", profileData);
}

export function getMyDressing() {
  return apiRequest("/dressing/me");
}


export function getCategories() {
  return apiRequest("/categorie");
}

export function getSousCategoriesByCategorie(id) {
  return apiRequest(`/sous-categorie/categorie/${id}`);
}


export function addClothing(clothingData) {
  return apiRequest("/vetement", "POST", clothingData);
}

export function updateClothing(id, clothingData) {
  return apiRequest(`/vetement/${id}`, "PUT", clothingData);
}

export function toggleFavorite(id, currentValue) {
  return apiRequest(`/vetement/${id}`, "PUT", {
    favori: !currentValue
  });
}

export function deleteClothing(id) {
  return apiRequest(`/vetement/${id}`, "DELETE");
}

export function getWeatherForMe() {
  return apiRequest("/meteo/me");
}
