const axios = require('axios');
const { mlTimeout } = require('./mlTimeout');
const { experimentalUrl } = require('./mlExperiment');

function postToMl(endpoint, payload, userId, { timeout } = {}) {
  if (!Number.isSafeInteger(userId) || userId <= 0 || userId > 2147483647) {
    throw new Error('Identifiant utilisateur ML invalide');
  }

  const secret = process.env.ML_SERVICE_SECRET;
  if (!secret) {
    throw new Error('ML_SERVICE_SECRET non configuré');
  }

  const baseUrl = (process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  const options = {
    headers: {
      'X-FITS-ML-SECRET': secret,
      'X-FITS-USER-ID': String(userId)
    },
    timeout: Number.isInteger(timeout) && timeout > 0 ? timeout : mlTimeout(endpoint)
  };
  const interactionUrl = experimentalUrl();
  // Delete both the active interaction model and any legacy RF artifact.
  if (endpoint === 'delete-model') {
    return Promise.all([
      axios.post(`${baseUrl}/${endpoint}`, payload, options),
      axios.post(`${interactionUrl}/${endpoint}`, payload, options)
    ]).then(([response]) => response);
  }
  return axios.post(`${interactionUrl}/${endpoint}`, payload, options);
}

module.exports = { postToMl };
