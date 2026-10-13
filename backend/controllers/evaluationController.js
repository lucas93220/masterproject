const axios = require("axios");
const Evaluation = require("../models/evaluation");
const Tenue = require("../models/tenue");

exports.create = async (req, res, next) => {
  try {
    const { id_tenue, is_liked } = req.body || {};

    if (!Number.isInteger(id_tenue) || id_tenue <= 0 || id_tenue > 2147483647) {
      return res.status(400).json({ message: "Identifiant de tenue invalide" });
    }

    if (typeof is_liked !== "boolean") {
      return res.status(400).json({ message: "is_liked doit être un booléen" });
    }

    const tenue = await Tenue.findByPk(id_tenue);

    if (!tenue) {
      return res.status(404).json({ message: "Tenue introuvable" });
    }

    if (tenue.id_utilisateur !== req.user.id) {
      return res.status(403).json({ message: "Cette tenue ne vous appartient pas" });
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
