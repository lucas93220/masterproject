const { postToMl } = require('./mlClient');
const { extractFeatures } = require('./outfitFeatures');
const { garmentIds, REPRESENTATION_VERSION } = require('./mlExperiment');

async function rankCandidates(candidates, temperature, schema, userId) {
  const rows = candidates.map(candidate => ({
    ...extractFeatures(candidate, temperature, schema), feature_version: schema.version
  }));
  let predictions = [];
  try {
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
    for (const data of predictions) validatePrediction(data);
    // Un modèle remplacé pendant le lot ne doit pas mélanger score appris et heuristique.
    if (new Set(predictions.map(item => item.model_used)).size > 1) {
      predictions = rows.map(row => ({ probability_like: row.ratio_favoris,
        model_used: 'fallback', reason: 'inconsistent_batch' }));
    } else if (new Set(predictions.map(item => item.model_revision)).size > 1) {
      throw new Error('Révisions ML incohérentes');
    }
  } catch {
    // Recalculer tout le lot : les scores appris et le ratio de favoris ne sont pas comparables.
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
      !['personalized', 'fallback'].includes(data.model_used) ||
      (data.model_used === 'personalized' && data.model_variant !== REPRESENTATION_VERSION)) {
    throw new Error('Réponse ML invalide');
  }
}
module.exports = { rankCandidates };
