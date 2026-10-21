// Explicit server-side opt-in. The mobile cannot choose the model or account.
const REPRESENTATION_VERSION = 'items-pairs-v1';

function experimentalUrl() {
  const configured = process.env.ML_EXPERIMENTAL_URL;
  if (!configured) {
    if (process.env.ML_EXPERIMENTAL_USER_ID) throw new Error('ML_EXPERIMENTAL_URL requis');
    return null;
  }
  const url = new URL(configured);
  const reference = new URL(process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000');
  if (process.env.NODE_ENV === 'production' || url.protocol !== 'http:' ||
      url.hostname !== '127.0.0.1' || !url.port || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash ||
      url.port === (reference.port || (reference.protocol === 'https:' ? '443' : '80'))) {
    throw new Error('Service expérimental local distinct requis, hors production');
  }
  return url.origin;
}

function experimentFor(userId) {
  const url = experimentalUrl();
  const id = process.env.ML_EXPERIMENTAL_USER_ID;
  if (!id) return false;
  if (!/^[1-9]\d{0,9}$/.test(id) || Number(id) > 2147483647) {
    throw new Error('ML_EXPERIMENTAL_USER_ID invalide');
  }
  return Boolean(url) && userId === Number(id);
}

function garmentIds(garments) {
  const ids = garments.map(item => item.id_vetement);
  if (!ids.length || ids.length > 40 ||
      ids.some(id => !Number.isInteger(id) || id <= 0 || id > 2147483647) ||
      new Set(ids).size !== ids.length) throw new Error('Identités des vêtements invalides');
  return ids.sort((a, b) => a - b);
}

module.exports = { experimentFor, experimentalUrl, garmentIds, REPRESENTATION_VERSION };
