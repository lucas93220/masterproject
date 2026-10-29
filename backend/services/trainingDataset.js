const Evaluation = require('../models/evaluation');
const Tenue = require('../models/tenue');
const Composer = require('../models/composer');
const Vetement = require('../models/vetement');
const SousCategorie = require('../models/sousCategorie');
const Zone = require('../models/zone');
const { loadFeatureSchema, extractFeatures } = require('./outfitFeatures');

function hasSnapshot(evaluation) {
  const snapshot = evaluation.feature_snapshot;
  return [1, 2, 3].includes(snapshot?.version) && Array.isArray(snapshot.garments) &&
    snapshot.garments.length > 0;
}

function validGarmentIds(ids, expectedLength) {
  return Array.isArray(ids) && ids.length === expectedLength &&
    ids.every(id => Number.isInteger(id) && id > 0 && id <= 2147483647) &&
    new Set(ids).size === ids.length;
}

async function buildTrainingDataset(userId, providedSchema,
  { includeTenueId = false, includeInteractionMetadata = false } = {}) {
  const evaluations = await Evaluation.findAll({
    where: { id_utilisateur: userId }
  });

  const validEvaluations = evaluations.filter(evaluation =>
    evaluation.id_utilisateur === userId &&
    Number.isInteger(evaluation.id_tenue) &&
    Number.isInteger(evaluation.temperature) &&
    typeof evaluation.is_liked === 'boolean'
  );

  if (!validEvaluations.length) return [];

  const tenueIds = [...new Set(validEvaluations.map(evaluation => evaluation.id_tenue))];
  const tenues = await Tenue.findAll({
    where: { id_tenue: tenueIds, id_utilisateur: userId }
  });
  const ownedTenues = new Map(tenues
    .filter(tenue => tenue.id_utilisateur === userId)
    .map(tenue => [tenue.id_tenue, tenue]));

  if (!ownedTenues.size) return [];

  const schema = providedSchema || await loadFeatureSchema();

  const compositions = await Composer.findAll({
    where: { id_tenue: [...ownedTenues.keys()] }
  });
  const vetementIdsByTenue = new Map();

  for (const composition of compositions) {
    if (!ownedTenues.has(composition.id_tenue)) continue;
    if (!vetementIdsByTenue.has(composition.id_tenue)) {
      vetementIdsByTenue.set(composition.id_tenue, []);
    }
    vetementIdsByTenue.get(composition.id_tenue).push(composition.id_vetement);
  }

  const vetementIds = [...new Set(validEvaluations
    .filter(evaluation => !hasSnapshot(evaluation))
    .flatMap(evaluation => vetementIdsByTenue.get(evaluation.id_tenue) || []))];
  const vetements = vetementIds.length ? await Vetement.findAll({
    where: { id_vetement: vetementIds },
    include: { model: SousCategorie, include: Zone }
  }) : [];
  const vetementsById = new Map(vetements.map(vetement => [vetement.id_vetement, vetement]));
  const dataset = [];

  for (const evaluation of validEvaluations) {
    const tenue = ownedTenues.get(evaluation.id_tenue);
    if (!tenue || tenue.temperature !== evaluation.temperature) continue;

    let clothes;
    if (hasSnapshot(evaluation)) {
      clothes = evaluation.feature_snapshot.garments;
    } else {
      const ids = vetementIdsByTenue.get(evaluation.id_tenue);
      if (!ids?.length || new Set(ids).size !== ids.length) continue;
      clothes = ids.map(id => vetementsById.get(id));
      if (clothes.some(item => !item)) continue;
      // Une ancienne évaluation ne peut pas acquérir après coup une seconde couleur.
      if (schema.v3) clothes = clothes.map(item => ({
        ...(typeof item.get === 'function' ? item.get({ plain: true }) : item), couleur_secondaire: null
      }));
    }

    let interactionMetadata = {};
    if (includeInteractionMetadata) {
      const snapshotIds = [2, 3].includes(evaluation.feature_snapshot?.version) &&
        clothes.map(item => item.id_vetement);
      const currentIds = vetementIdsByTenue.get(evaluation.id_tenue);
      const fromSnapshot = validGarmentIds(snapshotIds, clothes.length);
      const garmentIds = fromSnapshot ? snapshotIds : currentIds;
      if (!(evaluation.date_avis instanceof Date) &&
          typeof evaluation.date_avis !== 'string') continue;
      const reviewedAt = new Date(evaluation.date_avis);
      if (!validGarmentIds(garmentIds, clothes.length) ||
          !Number.isFinite(reviewedAt.getTime())) continue;
      interactionMetadata = {
        garment_ids: [...garmentIds].sort((a, b) => a - b),
        garment_ids_source: fromSnapshot ? 'snapshot' : 'composer_current',
        reviewed_at: reviewedAt.toISOString()
      };
    }

    dataset.push({ ...extractFeatures(clothes, evaluation.temperature, schema),
      is_liked: evaluation.is_liked ? 1 : 0,
      ...(includeTenueId || includeInteractionMetadata ? { id_tenue: evaluation.id_tenue } : {}),
      ...interactionMetadata });
  }

  return dataset;
}

module.exports = { buildTrainingDataset };
