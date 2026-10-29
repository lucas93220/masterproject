// Heuristiques initiales de sélection, pas des températures de confort mesurées.
// Les hauts de base restent disponibles dans le froid pour la superposition.
// Le générateur existant décide ensuite des couches et accessoires de la tenue.
const normalize = value => String(value || "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[-_]/g, " ");

const profiles = [
  [/\b(doudounes?|manteaux?|parkas?)\b/, -20, 12, "Vêtement d’extérieur chaud"],
  [/\b(vestes?|blousons?|bombers?|blazers?|impermeables?|trenchs?)\b/, -5, 18, "Vêtement d’extérieur"],
  [/\b(pulls?|sweats?|gilets?|cardigans?|polaires?)\b/, -20, 20, "Couche intermédiaire"],
  [/\b(chemises?|chemisiers?)\b/, -20, 28, "Haut compatible avec la superposition"],
  [/\b(t shirts?|tee shirts?|tshirts?|debardeurs?|polos?|hauts?)\b/, -20, 35, "Haut de base, seul ou sous une autre couche"],
  [/\b(shorts?|bermudas?)\b/, 18, 40, "Bas léger"],
  [/\b(pantalons?|jeans?|joggings?|leggings?)\b/, -10, 28, "Bas couvrant"],
  [/\b(robes?|jupes?)\b/, 12, 35, "Pièce légère ou intermédiaire"],
  [/\b(sandales?|tongs?|claquettes?)\b/, 20, 40, "Chaussures ouvertes"],
  [/\b(bottes?|bottines?)\b/, -20, 20, "Chaussures couvrantes"],
  [/\b(baskets?|sneakers?|chaussures?|mocassins?)\b/, -20, 40, "Chaussures fermées"],
  [/\b(bonnets?|echarpes?|gants?)\b/, -20, 12, "Accessoire pour le froid"],
  [/\b(casquettes?|chapeaux?|lunettes?|ceintures?|sacs?|bijoux?|montres?)\b/, -20, 40, "Accessoire" ]
];

export function thermalDefaults(subcategoryName) {
  const name = normalize(subcategoryName);
  const profile = profiles.find(([pattern]) => pattern.test(name));
  if (!profile) return { min: -20, max: 40, label: "Estimation générale", generic: true };
  const [, min, max, label] = profile;
  return { min, max, label, generic: false };
}
