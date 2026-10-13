const { buildTrainingDataset } = require("../services/trainingDataset");
const { postToMl } = require("../services/mlClient");

exports.trainModel = async (req, res, next) => {
  try {
    const dataset = await buildTrainingDataset(req.user.id);

    const response = await postToMl("train", {
      data: dataset
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
console.log("Features envoyées au ML:", features);
    const response = await postToMl("predict", features, req.user.id);

    res.json(response.data);

  } catch (error) {
    next(error);
  }
};
