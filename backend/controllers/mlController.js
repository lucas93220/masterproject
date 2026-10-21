const { buildTrainingDataset } = require("../services/trainingDataset");
const { postToMl } = require("../services/mlClient");
const { loadFeatureSchema } = require("../services/outfitFeatures");
const { experimentFor, REPRESENTATION_VERSION } = require('../services/mlExperiment');

exports.trainModel = async (req, res, next) => {
  try {
    const schema = await loadFeatureSchema();
    const experimental = experimentFor(req.user.id);
    const source = experimental
      ? await buildTrainingDataset(req.user.id, schema, { includeInteractionMetadata: true })
      : await buildTrainingDataset(req.user.id, schema);
    // Reconstructed historical identities are never used to train the experiment.
    const dataset = experimental ? source.filter(row => row.garment_ids_source === 'snapshot')
      .map(({ id_tenue, garment_ids_source, reviewed_at, ...row }) => row) : source;

    const response = await postToMl("train", {
      data: dataset,
      feature_version: schema.version,
      ...(experimental ? { representation_version: REPRESENTATION_VERSION } : {}),
      feature_catalog: {
        zones: schema.zoneNames,
        categories: schema.categoryVocabulary,
        subcategories: schema.subcategoryVocabulary
      }
    }, req.user.id);

    if (response.data.status === "insufficient_data") {
      return res.json({
        message: "Données insuffisantes pour entraîner un modèle personnalisé",
        ...response.data
      });
    }

    res.json({ message: "Model trained successfully" });

  } catch (error) {
    next(error);
  }
};

exports.predict = async (req, res, next) => {
  try {
    const features = req.body;
    const schema = await loadFeatureSchema();
    const response = await postToMl("predict", {
      ...features,
      feature_version: schema.version,
      ...(experimentFor(req.user.id) ? { representation_version: REPRESENTATION_VERSION } : {})
    }, req.user.id);

    res.json(response.data);

  } catch (error) {
    next(error);
  }
};
