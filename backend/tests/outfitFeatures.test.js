jest.mock("../models/categorie", () => ({ findAll: jest.fn() }));
jest.mock("../models/sousCategorie", () => ({ findAll: jest.fn() }));
jest.mock("../models/zone", () => ({ findAll: jest.fn() }));
jest.mock("../config/db", () => {
  throw new Error("Ce test ne doit pas ouvrir de connexion à la base");
});

const Categorie = require("../models/categorie");
const SousCategorie = require("../models/sousCategorie");
const Zone = require("../models/zone");
const { loadFeatureSchema, extractFeatures, snapshotGarment, colorBucket,
  PALETTE, CATEGORY_SLOTS, SUBCATEGORY_SLOTS } = require("../services/outfitFeatures");

const zones = [
  { id_zone: 2, nom_zone: "jambes" },
  { id_zone: 1, nom_zone: "torse" }
];
const categories = [
  { id_categorie: 2, nom_categorie: "Bas" },
  { id_categorie: 1, nom_categorie: "Hauts" }
];
const subcategories = [
  { id_sous_categorie: 20, id_categorie: 2, nom_sous_categorie: "Pantalon" },
  { id_sous_categorie: 10, id_categorie: 1, nom_sous_categorie: "T-shirt" },
  { id_sous_categorie: 11, id_categorie: 1, nom_sous_categorie: "Chemise" }
];
const garment = (id, zone, color) => ({
  id_sous_categorie: id, couleur: color, favori: true,
  sous_categorie: { id_categorie: id === 20 ? 2 : 1,
    nom_sous_categorie: subcategories.find(item => item.id_sous_categorie === id)?.nom_sous_categorie,
    zone: { nom_zone: zone } }
});

beforeEach(() => {
  jest.clearAllMocks();
  Zone.findAll.mockResolvedValue(zones);
  Categorie.findAll.mockResolvedValue(categories);
  SousCategorie.findAll.mockResolvedValue(subcategories);
});

test("couleurs et catégories différentes produisent des features différentes", async () => {
  const schema = await loadFeatureSchema();
  const blueShirt = extractFeatures([garment(10, "torse", "Bleu marine")], 18, schema);
  const redShirt = extractFeatures([garment(10, "torse", "rouge")], 18, schema);
  const blueChemise = extractFeatures([garment(11, "torse", "Bleu marine")], 18, schema);

  expect(blueShirt.couleur_bleu).toBe(1);
  expect(redShirt.couleur_rouge).toBe(1);
  expect(blueShirt).not.toEqual(redShirt);
  expect(blueShirt).not.toEqual(blueChemise);
  expect(blueShirt.sous_categorie_inconnue).toBe(0);
});

test("les associations haut/bas distinguent accord et contraste", async () => {
  const schema = await loadFeatureSchema();
  const matching = extractFeatures([
    garment(10, "torse", "bleu"), garment(20, "jambes", "bleu")
  ], 18, schema);
  const contrast = extractFeatures([
    garment(10, "torse", "noir"), garment(20, "jambes", "rouge")
  ], 18, schema);

  expect(matching.association_torse_jambes_meme_couleur).toBe(1);
  expect(matching.association_torse_jambes_neutre_colore).toBe(0);
  expect(contrast.association_torse_jambes_meme_couleur).toBe(0);
  expect(contrast.association_torse_jambes_neutre_colore).toBe(1);
  expect(contrast.couleur_torse_noir).toBe(1);
  expect(contrast.couleur_jambes_rouge).toBe(1);
});

test("les inconnues et valeurs manquantes restent numériques et bornées", async () => {
  const schema = await loadFeatureSchema();
  const features = extractFeatures([
    { couleur: "ultraviolet imaginaire", favori: null,
      zone_name: "torse", category_name: "exotique", subcategory_name: "inédite" },
    { couleur: null, favori: null }
  ], 18, schema);

  expect(colorBucket("ultraviolet imaginaire")).toBe("autre");
  expect(features.couleur_autre).toBe(1);
  expect(features.couleur_inconnu).toBe(1);
  expect(features.categorie_autre).toBe(1);
  expect(features.categorie_inconnue).toBe(1);
  expect(features.sous_categorie_autre).toBe(1);
  expect(features.sous_categorie_inconnue).toBe(1);
  expect(Object.values(features).every(Number.isFinite)).toBe(true);
});

test("nombre, ordre et version sont stables pour le même catalogue", async () => {
  const first = await loadFeatureSchema();
  const firstFeatures = extractFeatures([garment(10, "torse", "bleu"),
    garment(20, "jambes", "noir")], 18, first);
  Zone.findAll.mockResolvedValue([...zones].reverse());
  Categorie.findAll.mockResolvedValue([...categories].reverse());
  SousCategorie.findAll.mockResolvedValue([...subcategories].reverse());
  const second = await loadFeatureSchema();
  const secondFeatures = extractFeatures([garment(20, "jambes", "noir"),
    garment(10, "torse", "bleu")], 18, second);

  expect(first.version).toBe(second.version);
  expect(Object.keys(firstFeatures)).toEqual(Object.keys(secondFeatures));
  expect(firstFeatures).toEqual(secondFeatures);
  expect(Object.keys(firstFeatures)).toHaveLength(4 + zones.length +
    PALETTE.length * 3 + CATEGORY_SLOTS + 2 + SUBCATEGORY_SLOTS + 2 + 2);
});

test("un changement du catalogue change la version sans modifier les modèles", async () => {
  const first = await loadFeatureSchema();
  Categorie.findAll.mockResolvedValue([...categories,
    { id_categorie: 3, nom_categorie: "Accessoires" }]);
  const second = await loadFeatureSchema();
  expect(second.version).not.toBe(first.version);
});

test("l'instantané conserve les valeurs du vêtement avant modification", async () => {
  const schema = await loadFeatureSchema();
  const clothing = garment(10, "torse", "bleu");
  const saved = snapshotGarment(clothing, schema);
  clothing.couleur = "rouge";
  clothing.sous_categorie.nom_sous_categorie = "Autre";
  const features = extractFeatures([saved], 18, schema);
  expect(features.couleur_bleu).toBe(1);
  expect(features.couleur_rouge).toBe(0);
  expect(saved.subcategory_name).toBe("t-shirt");
});
