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

export async function generateTenue(temperature) {
  const token = await AsyncStorage.getItem("token");

  const response = await fetch(
    `${API_URL}/tenue/generate?temperature=${temperature}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Erreur génération tenue");
  }

  return data;
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

export function evaluateTenue(id_tenue, is_liked) {
  return apiRequest("/evaluation", "POST", {
    id_tenue,
    is_liked
  });
}

export const uploadImage = async (uri) => {
  const formData = new FormData();

  formData.append("image", {
    uri,
    name: "photo.jpg",
    type: "image/jpeg",
  });

  const response = await fetch("http://192.168.1.17:3002/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    console.log("UPLOAD ERROR:", text);
    throw new Error("Erreur upload image");
  }

  const data = await response.json();
  return data.imageUrl;
};