const { buildTrainingDataset } = require("../services/trainingDataset");
const { postToMl } = require("../services/mlClient");
const { loadFeatureSchema } = require("../services/outfitFeatures");

exports.trainModel = async (req, res, next) => {
  try {
    const schema = await loadFeatureSchema();
    const dataset = await buildTrainingDataset(req.user.id, schema);

    const response = await postToMl("train", {
      data: dataset,
      feature_version: schema.version,
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
      feature_version: schema.version
    }, req.user.id);

    res.json(response.data);

  } catch (error) {
    next(error);
  }
};
