const { wardrobeV3 } = require('./wardrobeVersion');
const LEGACY_COLORS = Object.freeze([
  'noir', 'blanc', 'gris', 'bleu', 'rouge', 'vert', 'jaune',
  'orange', 'rose', 'violet', 'marron', 'beige'
]);
const EXTENDED_COLORS = Object.freeze([...LEGACY_COLORS, 'bleu marine', 'kaki', 'bordeaux', 'écru', 'argenté', 'doré']);
const SELECTABLE_COLORS = wardrobeV3() ? EXTENDED_COLORS : LEGACY_COLORS;
const PALETTE = [...LEGACY_COLORS, 'autre', 'inconnu'];
const paletteV3 = [...EXTENDED_COLORS, 'autre', 'inconnu'];
const COLOR_ALIASES = {
  black: 'noir', noire: 'noir', white: 'blanc', blanche: 'blanc',
  gray: 'gris', grey: 'gris', grise: 'gris', blue: 'bleu', bleue: 'bleu',
  red: 'rouge', green: 'vert', yellow: 'jaune', pink: 'rose',
  purple: 'violet', brown: 'marron', tan: 'beige',
  navy: 'bleu marine', khaki: 'kaki', burgundy: 'bordeaux',
  ecru: 'écru', argente: 'argenté', dore: 'doré', silver: 'argenté', gold: 'doré'
};

function normalize(value) {
  return typeof value === 'string'
    ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
    : '';
}

function canonicalColor(value) {
  const normalized = normalize(value);
  const color = COLOR_ALIASES[normalized] || normalized;
  return SELECTABLE_COLORS.find(item => normalize(item) === normalize(color)) || null;
}

// Lecture tolérante des anciennes valeurs libres ; les nouvelles écritures utilisent canonicalColor.
function colorBucket(value) {
  const normalized = normalize(value);
  if (!normalized) return 'inconnu';
  for (const word of normalized.split(/[^a-z]+/).filter(Boolean)) {
    const bucket = COLOR_ALIASES[word] || (PALETTE.includes(word) ? word : null);
    if (bucket && PALETTE.includes(bucket) && bucket !== 'autre' && bucket !== 'inconnu') return bucket;
  }
  return 'autre';
}

function colorBucketV3(value) {
  const normalized = normalize(value);
  const exact = EXTENDED_COLORS.find(color => normalize(color) === normalize(COLOR_ALIASES[normalized] || value));
  return exact || colorBucket(value);
}
function garmentColors(item) {
  return wardrobeV3() ? [...new Set([item.couleur, item.couleur_secondaire].filter(Boolean).map(colorBucketV3))] : [colorBucket(item.couleur)];
}
// Une seule validation pour create, update et update administrateur.
function colorValues(body, previous = {}) {
  if (body.couleur_secondaire !== undefined && !wardrobeV3()) {
    const error = new Error('Deux couleurs indisponibles avant activation du catalogue'); error.status = 409; throw error;
  }
  const values = {};
  if (body.couleur !== undefined) {
    values.couleur = canonicalColor(body.couleur);
    if (!values.couleur) { const error = new Error('Choisissez une couleur de la palette'); error.status = 400; throw error; }
  }
  if (wardrobeV3() && body.couleur_secondaire !== undefined) {
    const secondary = body.couleur_secondaire;
    values.couleur_secondaire = secondary === null ? null : canonicalColor(secondary);
    if (secondary !== null && !values.couleur_secondaire) {
      const error = new Error('Couleur secondaire invalide'); error.status = 400; throw error;
    }
  }
  const primary = values.couleur || canonicalColor(previous.couleur) || previous.couleur;
  const secondary = Object.hasOwn(values, 'couleur_secondaire') ? values.couleur_secondaire : previous.couleur_secondaire;
  if (wardrobeV3() && secondary && secondary === primary) {
    const error = new Error('Choisissez deux couleurs différentes'); error.status = 400; throw error;
  }
  return values;
}
module.exports = { SELECTABLE_COLORS, PALETTE, paletteV3, canonicalColor, colorBucket, colorBucketV3, garmentColors, colorValues };
