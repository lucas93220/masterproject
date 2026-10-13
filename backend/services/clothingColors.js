const SELECTABLE_COLORS = Object.freeze([
  'noir', 'blanc', 'gris', 'bleu', 'rouge', 'vert', 'jaune',
  'orange', 'rose', 'violet', 'marron', 'beige'
]);
const PALETTE = [...SELECTABLE_COLORS, 'autre', 'inconnu'];
const COLOR_ALIASES = {
  black: 'noir', noire: 'noir', white: 'blanc', blanche: 'blanc',
  gray: 'gris', grey: 'gris', grise: 'gris', blue: 'bleu', bleue: 'bleu',
  red: 'rouge', green: 'vert', yellow: 'jaune', pink: 'rose',
  purple: 'violet', brown: 'marron', tan: 'beige'
};

function normalize(value) {
  return typeof value === 'string'
    ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
    : '';
}

function canonicalColor(value) {
  const normalized = normalize(value);
  const color = COLOR_ALIASES[normalized] || normalized;
  return SELECTABLE_COLORS.includes(color) ? color : null;
}

// Lecture tolérante des anciennes valeurs libres ; les nouvelles écritures utilisent canonicalColor.
function colorBucket(value) {
  const normalized = normalize(value);
  if (!normalized) return 'inconnu';
  for (const word of normalized.split(/[^a-z]+/).filter(Boolean)) {
    const bucket = COLOR_ALIASES[word] || (PALETTE.includes(word) ? word : null);
    if (bucket && bucket !== 'autre' && bucket !== 'inconnu') return bucket;
  }
  return 'autre';
}

module.exports = { SELECTABLE_COLORS, PALETTE, canonicalColor, colorBucket };
