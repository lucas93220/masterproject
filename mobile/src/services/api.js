import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const expoHost = (Constants.expoConfig?.hostUri || Constants.expoGoConfig?.debuggerHost || "")
  .match(/^(?:[a-z]+:\/\/)?([\w.-]+)(?::\d+)?$/i)?.[1];
const localExpoHost = /^(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)$/i
  .test(expoHost || "") ? expoHost : null;
const API_URL = process.env.EXPO_PUBLIC_API_URL ||
  `http://${localExpoHost || "192.168.1.17"}:3002/api`;
const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

export function resolveImageUrl(uri) {
  if (typeof uri !== "string") return uri;
  if (/^\/uploads\/[^/?#]+\.(?:jpe?g|png|webp)$/i.test(uri)) return `${API_ORIGIN}${uri}`;
  const match = /^https?:\/\/([^/]+)(\/uploads\/[^/?#]+\.(?:jpe?g|png|webp))(?:[?#].*)?$/i.exec(uri);
  if (!match) return uri;
  const host = match[1].replace(/:\d+$/, "");
  if (!/^(?:localhost$|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/i.test(host)) {
    return uri;
  }
  return `${API_ORIGIN}${match[2]}`;
}

export async function imageSource(uri) {
  const resolved = resolveImageUrl(uri);
  if (!resolved) return null;
  // Ne jamais transmettre le JWT à une image externe, même si son chemin contient /uploads.
  if (!resolved.startsWith(`${API_ORIGIN}/uploads/`)) return { uri: resolved };
  const token = await AsyncStorage.getItem('token');
  if (!token) return null;
  return { uri: resolved, headers: { Authorization: `Bearer ${token}` }, cache: 'reload' };
}

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

export function deleteMyAccount() {
  return apiRequest("/utilisateur/me", "DELETE");
}

export function getMyDressing() {
  return apiRequest("/dressing/me");
}


export function getCategories() {
  return apiRequest("/categorie");
}

export async function generateTenue(temperature, weatherIcon = null) {
  const token = await AsyncStorage.getItem("token");
  const query = `temperature=${encodeURIComponent(temperature)}` +
    (weatherIcon ? `&weatherIcon=${encodeURIComponent(weatherIcon)}` : '');

  const response = await fetch(
    `${API_URL}/tenue/generate?${query}`,
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

async function imageFormData(uri, mimeType) {
  const extension = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(uri)?.[1]?.toLowerCase();
  const formats = {
    jpg: { name: "photo.jpg", type: "image/jpeg" },
    jpeg: { name: "photo.jpg", type: "image/jpeg" },
    png: { name: "photo.png", type: "image/png" },
    webp: { name: "photo.webp", type: "image/webp" }
  };
  const format = formats[extension] || Object.values(formats).find(item => item.type === mimeType);
  if (!format) throw new Error("Format image non pris en charge : choisir JPEG, PNG ou WebP");
  const formData = new FormData();

  if (/^(?:blob:|data:image\/)/i.test(uri)) {
    // La photothèque web fournit une URL locale ; le navigateur attend un Blob.
    // Aucun jeton n'est envoyé lors de la lecture de cette ressource locale.
    const localImage = await fetch(uri);
    if (!localImage.ok) throw new Error("Impossible de lire la photo sélectionnée");
    formData.append("image", await localImage.blob(), format.name);
  } else {
    formData.append("image", { uri, name: format.name, type: format.type });
  }

  return formData;
}

export const uploadImage = async (uri, mimeType) => {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("Connexion requise pour envoyer une image");
  const formData = await imageFormData(uri, mimeType);
  const response = await fetch(`${API_URL}/upload`, {
    method: "POST",
    body: formData,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const text = await response.text();
    console.log("UPLOAD ERROR:", text);
    throw new Error("Erreur upload image");
  }

  const data = await response.json();
  return data.imageUrl;
};

export async function analyzeClothingImage(uri, mimeType) {
  const token = await AsyncStorage.getItem('token');
  if (!token) throw new Error('Connexion requise pour analyser une photo');
  const formData = await imageFormData(uri, mimeType);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(`${API_URL}/clothing-analysis`, {
      method: 'POST', body: formData,
      headers: { Authorization: `Bearer ${token}` }, signal: controller.signal
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || 'Impossible d’analyser la photo. Continue manuellement.');
    if (!data?.suggestion || typeof data.suggestion !== 'object' || Array.isArray(data.suggestion)) {
      throw new Error('Analyse photo illisible. Continue manuellement.');
    }
    return data.suggestion;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('L’analyse photo prend trop de temps. Réessaie.');
    if (error instanceof TypeError) throw new Error('Connexion impossible pour analyser la photo. Tu peux continuer manuellement.');
    throw error;
  } finally { clearTimeout(timer); }
}
