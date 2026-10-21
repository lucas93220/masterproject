// The interaction model is the normal scorer. The mobile cannot choose a model.
const REPRESENTATION_VERSION = 'items-pairs-v1';

function experimentalUrl() {
  const configured = process.env.ML_EXPERIMENTAL_URL || 'http://127.0.0.1:8001';
  const url = new URL(configured);
  const reference = new URL(process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000');
  if (url.protocol !== 'http:' ||
      url.hostname !== '127.0.0.1' || !url.port || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash ||
      url.port === (reference.port || (reference.protocol === 'https:' ? '443' : '80'))) {
    throw new Error('Service articles/paires local distinct requis');
  }
  return url.origin;
}

function garmentIds(garments) {
  const ids = garments.map(item => item.id_vetement);
  if (!ids.length || ids.length > 40 ||
      ids.some(id => !Number.isInteger(id) || id <= 0 || id > 2147483647) ||
      new Set(ids).size !== ids.length) throw new Error('Identités des vêtements invalides');
  return ids.sort((a, b) => a - b);
}

module.exports = { experimentalUrl, garmentIds, REPRESENTATION_VERSION };
