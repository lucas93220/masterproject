const { createHash } = require('node:crypto');
const Categorie = require('../models/categorie');
const SousCategorie = require('../models/sousCategorie');
const Zone = require('../models/zone');
const { PALETTE, paletteV3, colorBucket, colorBucketV3 } = require('./clothingColors');
const { wardrobeV3 } = require('./wardrobeVersion');
const CATEGORY_SLOTS = 8;
const SUBCATEGORY_SLOTS = 16;
const SCHEMA_PREFIX = 'outfit-v2-';

function normalize(value) {
  return typeof value === 'string'
    ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ')
    : '';
}

function uniqueSorted(values) {
  return [...new Set(values.map(normalize).filter(Boolean))].sort();
}

function subcategoryToken(category, subcategory) {
  return JSON.stringify([category, subcategory]);
}

async function loadFeatureSchema() {
  const [zones, categories, subcategories] = await Promise.all([
    Zone.findAll(), Categorie.findAll(), SousCategorie.findAll()
  ]);
  const categoryById = new Map(categories.map(item =>
    [item.id_categorie, normalize(item.nom_categorie)]));
  const subcategoryById = new Map(subcategories.map(item => [item.id_sous_categorie, {
    category: categoryById.get(item.id_categorie) || '',
    subcategory: normalize(item.nom_sous_categorie)
  }]));
  const zoneNames = uniqueSorted(zones.map(zone => zone.nom_zone));
  const categoryVocabulary = uniqueSorted([...categoryById.values()]).slice(0, CATEGORY_SLOTS);
  const v3 = wardrobeV3();
  const palette = v3 ? paletteV3 : PALETTE;
  const subcategoryVocabulary = uniqueSorted([...subcategoryById.values()].map(item =>
    item.category && item.subcategory ? subcategoryToken(item.category, item.subcategory) : ''
  )).slice(0, v3 ? 128 : SUBCATEGORY_SLOTS);
  const signature = JSON.stringify({ zoneNames, categoryVocabulary, subcategoryVocabulary,
    ...(v3 ? { palette, encoding: 3 } : {}) });
  const version = (v3 ? 'outfit-v3-' : SCHEMA_PREFIX) + createHash('sha256').update(signature).digest('hex');

  return { version, zoneNames, categoryVocabulary, subcategoryVocabulary,
    categoryById, subcategoryById, ...(v3 ? { palette, v3: true } : {}) };
}

function snapshotGarment(garment, schema) {
  const subcategory = garment.sous_categorie;
  const catalogItem = schema.subcategoryById.get(garment.id_sous_categorie) || {};
  return {
    couleur: typeof garment.couleur === 'string' ? garment.couleur : null,
    ...(schema.v3 ? { couleur_secondaire: typeof garment.couleur_secondaire === 'string' ? garment.couleur_secondaire : null } : {}),
    favori: garment.favori === true,
    zone_name: normalize(garment.zone_name || subcategory?.zone?.nom_zone),
    category_name: normalize(garment.category_name || catalogItem.category ||
      schema.categoryById.get(subcategory?.id_categorie)),
    subcategory_name: normalize(garment.subcategory_name || catalogItem.subcategory ||
      subcategory?.nom_sous_categorie)
  };
}

function dominantColor(clothes, zone, palette = PALETTE, bucket = colorBucket) {
  const counts = new Map();
  for (const item of clothes) {
    if (item.zone_name !== zone) continue;
    const color = bucket(item.couleur);
    if (color === 'autre' || color === 'inconnu') continue;
    counts.set(color, (counts.get(color) || 0) + 1);
  }
  return palette.find(color => counts.get(color) === Math.max(0, ...counts.values())) || null;
}

function extractFeatures(garments, temperature, schema) {
  const palette = schema.palette || PALETTE;
  const bucket = schema.v3 ? colorBucketV3 : colorBucket;
  const colors = item => schema.v3 ? [bucket(item.couleur), ...(item.couleur_secondaire ? [bucket(item.couleur_secondaire)] : [])] : [bucket(item.couleur)];
  const clothes = garments.map(item => snapshotGarment(item, schema));
  const favorites = clothes.filter(item => item.favori).length;
  const features = {
    temperature,
    nb_vetements: clothes.length,
    nb_favoris: favorites,
    ratio_favoris: clothes.length ? favorites / clothes.length : 0
  };

  for (const zone of schema.zoneNames) {
    features[`zone_${zone}`] = Number(clothes.some(item => item.zone_name === zone));
  }

  for (const color of palette) {
    features[`couleur_${color}`] = Number(clothes.some(item => colors(item).includes(color)));
  }
  for (const zone of ['torse', 'jambes']) {
    for (const color of palette) {
      features[`couleur_${zone}_${color}`] = Number(clothes.some(item =>
        item.zone_name === zone && colors(item).includes(color)));
    }
  }

  for (let index = 0; index < CATEGORY_SLOTS; index++) {
    const category = schema.categoryVocabulary[index];
    features[`categorie_${String(index).padStart(2, '0')}`] = Number(Boolean(category) &&
      clothes.some(item => item.category_name === category));
  }
  features.categorie_autre = Number(clothes.some(item => item.category_name &&
    !schema.categoryVocabulary.includes(item.category_name)));
  features.categorie_inconnue = Number(clothes.some(item => !item.category_name));

  for (let index = 0; index < (schema.v3 ? Math.max(SUBCATEGORY_SLOTS, schema.subcategoryVocabulary.length) : SUBCATEGORY_SLOTS); index++) {
    const token = schema.subcategoryVocabulary[index];
    features[`sous_categorie_${String(index).padStart(2, '0')}`] = Number(Boolean(token) &&
      clothes.some(item => subcategoryToken(item.category_name, item.subcategory_name) === token));
  }
  features.sous_categorie_autre = Number(clothes.some(item => item.subcategory_name &&
    !schema.subcategoryVocabulary.includes(subcategoryToken(item.category_name, item.subcategory_name))));
  features.sous_categorie_inconnue = Number(clothes.some(item => !item.subcategory_name));

  const neutral = new Set(['noir', 'blanc', 'gris', 'marron', 'beige', ...(schema.v3 ? ['écru', 'bleu marine'] : [])]);
  const topColor = dominantColor(clothes, 'torse', palette, bucket);
  const bottomColor = dominantColor(clothes, 'jambes', palette, bucket);
  features.association_torse_jambes_meme_couleur = Number(Boolean(topColor && bottomColor &&
    topColor === bottomColor));
  features.association_torse_jambes_neutre_colore = Number(Boolean(topColor && bottomColor &&
    neutral.has(topColor) !== neutral.has(bottomColor)));
  return features;
}

module.exports = { loadFeatureSchema, snapshotGarment, extractFeatures, colorBucket,
  PALETTE, CATEGORY_SLOTS, SUBCATEGORY_SLOTS };
