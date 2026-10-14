function mlTimeout(endpoint) {
  const fallback = endpoint === 'train' ? 15000 : 2000;
  const setting = endpoint === 'train' ? 'ML_TRAIN_TIMEOUT_MS' : 'ML_PREDICT_TIMEOUT_MS';
  const value = Number(process.env[setting] || fallback);
  if (!Number.isInteger(value) || value < 1 || value > 120000) {
    throw new Error(`${setting} doit être compris entre 1 et 120000 ms`);
  }
  return value;
}
module.exports = { mlTimeout };
