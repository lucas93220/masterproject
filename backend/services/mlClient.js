const axios = require('axios');

function postToMl(endpoint, payload, userId) {
  if (!Number.isSafeInteger(userId) || userId <= 0 || userId > 2147483647) {
    throw new Error('Identifiant utilisateur ML invalide');
  }

  const secret = process.env.ML_SERVICE_SECRET;
  if (!secret) {
    throw new Error('ML_SERVICE_SECRET non configuré');
  }

  const baseUrl = (process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  return axios.post(`${baseUrl}/${endpoint}`, payload, {
    headers: {
      'X-FITS-ML-SECRET': secret,
      'X-FITS-USER-ID': String(userId)
    }
  });
}

module.exports = { postToMl };
