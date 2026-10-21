const axios = require('axios');
const { mlTimeout } = require('./mlTimeout');
const { experimentFor, experimentalUrl } = require('./mlExperiment');

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
  // Deletion covers both stores even after disabling the account experiment.
  // Keep ML_EXPERIMENTAL_URL configured until its private store is retired.
  if (endpoint === 'delete-model' && experimentalUrl()) {
    return Promise.all([
      axios.post(`${baseUrl}/${endpoint}`, payload, options),
      axios.post(`${experimentalUrl()}/${endpoint}`, payload, options)
    ]).then(([response]) => response);
  }
  const target = experimentFor(userId) ? experimentalUrl() : baseUrl;
  return axios.post(`${target}/${endpoint}`, payload, options);
}

module.exports = { postToMl };
