import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "http://192.168.1.181:3002/api";
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

export const uploadImage = async (uri, mimeType) => {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("Connexion requise pour envoyer une image");
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

  formData.append("image", {
    uri,
    name: format.name,
    type: format.type,
  });

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
