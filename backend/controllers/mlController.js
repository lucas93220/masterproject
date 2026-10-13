const axios = require("axios");
const { buildTrainingDataset } = require("../services/trainingDataset");

exports.trainModel = async (req, res, next) => {
  try {
    const dataset = await buildTrainingDataset(req.user.id);

    await axios.post("http://localhost:8000/train", {
      data: dataset
    });

    res.json({ message: "Model trained successfully" });

  } catch (error) {
    next(error);
  }
};

exports.predict = async (req, res, next) => {
  try {
    const features = req.body;
console.log("Features envoyées au ML:", features);
    const response = await axios.post(
      "http://localhost:8000/predict",
      features
    );

    res.json(response.data);

  } catch (error) {
    next(error);
  }
};
