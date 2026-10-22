const Log = require('../models/log');

// Trace uniquement la tenue effectivement présentée, avant la réponse HTTP et le vote.
// Elle suit la même suppression de compte et la même rétention que les autres logs Mongo.
async function recordDisplayedPrediction({ userId, outfitId, prediction, featureVersion }) {
  if (Log.db.readyState !== 1) return false;
  try {
    await Log.create({
      userId: String(userId),
      action: 'outfit_prediction',
      details: {
        id_tenue: outfitId,
        probability_like: prediction.probability_like,
        model_used: prediction.model_used,
        model_variant: prediction.model_variant || null,
        model_revision: prediction.model_revision || null,
        feature_version: featureVersion
      }
    });
    return true;
  } catch {
    console.error('Trace de prédiction MongoDB indisponible');
    return false;
  }
}

module.exports = { recordDisplayedPrediction };
