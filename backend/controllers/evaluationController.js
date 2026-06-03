const axios = require("axios");
const Evaluation = require("../models/evaluation");
const Tenue = require("../models/tenue");

exports.create = async (req, res, next) => {
  try {
    const { id_tenue, is_liked } = req.body;

    const tenue = await Tenue.findByPk(id_tenue);

    if (!tenue) {
      return res.status(404).json({ message: "Tenue introuvable" });
    }

    const [evaluation] = await Evaluation.upsert({
      id_utilisateur: req.user.id,
      id_tenue,
      is_liked,
      temperature: tenue.temperature,
      date_avis: new Date()
    });

    try {
      await axios.post("http://localhost:3002/api/ml/train", {}, {
        headers: {
          Authorization: req.headers.authorization
        }
      });
      console.log("Modèle réentraîné automatiquement");
    } catch (trainError) {
      console.log("Erreur retrain (non bloquante) :", trainError.message);
    }

    res.status(201).json(evaluation);

  } catch (error) {
    next(error);
  }
};