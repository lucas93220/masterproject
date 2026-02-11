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

export async function updateProfile(profileData) {
  const token = await AsyncStorage.getItem("token");

  const response = await fetch("http://localhost:3002/api/utilisateur/me", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(profileData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Erreur mise à jour profil");
  }

  return response.json();
}

// Récupérer le dressing de l'utilisateur
export async function getMyDressing() {
  const token = await AsyncStorage.getItem("token");

  const response = await fetch(`${API_URL}/dressing/me`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Erreur chargement dressing");
  }

  return data;
}

export const getCategories = async () => {
  const token = await AsyncStorage.getItem("token");
  const res = await fetch("http://localhost:3002/api/categorie", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) throw new Error("Erreur chargement catégories");
  return res.json();
};


// Ajouter un vêtement au dressing
export async function addClothing(clothingData) {
  const token = await AsyncStorage.getItem("token");

  const response = await fetch(`${API_URL}/vetement`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(clothingData)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Erreur ajout vêtement");
  }

  return data;
}

export async function updateClothing(id, clothingData) {
  const token = await AsyncStorage.getItem("token");

  const response = await fetch(
    `http://localhost:3002/api/vetement/${id}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(clothingData)
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Erreur modification vêtement");
  }

  return data;
}

export async function toggleFavorite(id, currentValue) {
  const token = await AsyncStorage.getItem("token");

  const response = await fetch(
    `http://localhost:3002/api/vetement/${id}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ favori: !currentValue })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Erreur favori");
  }

  return data;
}


// Supprimer un vêtement
export async function deleteClothing(id) {
  const token = await AsyncStorage.getItem("token");

  const response = await fetch(`${API_URL}/vetement/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error("Erreur suppression vêtement");
  }
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
