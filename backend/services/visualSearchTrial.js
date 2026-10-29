// Adaptateur partagé par le script d’essai et le préremplissage, sans accès aux bases ni au ML.
const { imageType } = require('../middlewares/imageUpload');
const MAX_TRIAL_BYTES = 500000;

function validateImage(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_TRIAL_BYTES) {
    throw new Error('Choisis une image JPEG, PNG ou WebP de 500 Ko maximum.');
  }
  for (const mimetype of ['image/jpeg', 'image/png', 'image/webp']) {
    const type = imageType({ buffer, mimetype });
    if (type) return type;
  }
  throw new Error('Format non pris en charge : JPEG, PNG ou WebP attendu.');
}

const cleanText = value => typeof value === 'string'
  ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 300) : '';

function webLink(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

async function requestJson(fetchImpl, url, options, signal) {
  try {
    const response = await fetchImpl(url, { ...options, redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error('provider');
    const data = await response.json();
    if (!data || typeof data !== 'object' || data.error) throw new Error('provider');
    return data;
  } catch {
    // Une erreur réseau brute peut contenir la clé, l’image ou l’URL de recherche.
    throw new Error('Recherche visuelle indisponible. Vérifie la clé, le quota et la connexion ; aucun réessai automatique.');
  }
}

async function searchVisualMatches(buffer, { apiKey, fetchImpl = fetch, signal } = {}) {
  const type = validateImage(buffer);
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('SERPAPI_API_KEY manquante dans backend/.env.');
  const body = new FormData();
  body.append('image', new Blob([buffer], { type: type.contentType }), `image${type.extension}`);
  body.append('api_key', apiKey.trim());
  const uploaded = await requestJson(fetchImpl, 'https://serpapi.com/image', { method: 'POST', body }, signal);
  if (typeof uploaded.image_id !== 'string' || !uploaded.image_id.trim()) {
    throw new Error('Le fournisseur n’a pas retourné d’identifiant image exploitable.');
  }
  const params = new URLSearchParams({ engine: 'google_lens', type: 'visual_matches',
    image_id: uploaded.image_id, api_key: apiKey.trim(), hl: 'fr', country: 'fr' });
  const result = await requestJson(fetchImpl, `https://serpapi.com/search.json?${params}`, { method: 'GET' }, signal);
  // Liste de pistes, jamais présentée comme une identification confirmée.
  // Ne pas transmettre au mobile les métadonnées fournisseur contenant la clé.
  const matches = [];
  const seen = new Set();
  for (const item of Array.isArray(result.visual_matches) ? result.visual_matches : []) {
    const title = cleanText(item?.title);
    const link = webLink(item?.link);
    if (!title || !link || seen.has(link)) continue;
    seen.add(link);
    matches.push({ rank: matches.length + 1, title, source: cleanText(item.source), link });
    if (matches.length === 5) break;
  }
  return { provider: 'serpapi-google-lens', status: matches.length ? 'matches' : 'no_matches',
    identification_confirmed: false, matches };
}

module.exports = { validateImage, searchVisualMatches, MAX_TRIAL_BYTES };
