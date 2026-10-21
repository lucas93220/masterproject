const { postToMl } = require('./mlClient');
const { extractFeatures } = require('./outfitFeatures');
const { experimentFor, garmentIds, REPRESENTATION_VERSION } = require('./mlExperiment');

async function rankCandidates(candidates, temperature, schema, userId) {
  const rows = candidates.map(candidate => ({
    ...extractFeatures(candidate, temperature, schema), feature_version: schema.version
  }));
  let predictions = [];
  try {
    if (experimentFor(userId)) {
      const { data } = await postToMl('predict-batch', {
        feature_version: schema.version,
        representation_version: REPRESENTATION_VERSION,
        candidates: rows.map(({ feature_version, ...row }, index) => ({
          ...row, garment_ids: garmentIds(candidates[index])
        }))
      }, userId);
      if (!Array.isArray(data?.predictions) || data.predictions.length !== rows.length) {
        throw new Error('Lot ML invalide');
      }
      predictions = data.predictions;
    } else {
      for (const row of rows) {
        const { data } = await postToMl('predict', row, userId);
        predictions.push(data);
        validatePrediction(data);
      }
    }
    for (const data of predictions) validatePrediction(data);
    // Experimental batches must have been scored with one frozen model revision.
    if (new Set(predictions.map(item => item.model_revision)).size > 1) {
      throw new Error('Révisions ML incohérentes');
    }
    // Un modèle remplacé pendant le lot ne doit pas mélanger score appris et heuristique.
    if (new Set(predictions.map(item => item.model_used)).size > 1) {
      predictions = rows.map(row => ({ probability_like: row.ratio_favoris,
        model_used: 'fallback', reason: 'inconsistent_batch' }));
    }
  } catch {
    // Recalculer tout le lot : les probabilités RF et le ratio de favoris ne sont pas comparables.
    // Arrêter dès le premier échec évite de multiplier le délai de panne.
    predictions = rows.map(row => ({ probability_like: row.ratio_favoris,
      model_used: 'fallback', reason: 'ml_unavailable' }));
  }
  let best = 0;
  for (let i = 1; i < predictions.length; i++) {
    if (predictions[i].probability_like > predictions[best].probability_like) best = i;
  }
  return { candidate: candidates[best], prediction: predictions[best] };
}

function validatePrediction(data) {
  if (typeof data?.probability_like !== 'number' || !Number.isFinite(data.probability_like) ||
      data.probability_like < 0 || data.probability_like > 1 ||
      !['personalized', 'fallback'].includes(data.model_used)) {
    throw new Error('Réponse ML invalide');
  }
}
module.exports = { rankCandidates };
