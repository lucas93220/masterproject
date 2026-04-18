const axios = require("axios");
const Evaluation = require("../models/evaluation");
const Tenue = require("../models/tenue");
const Composer = require("../models/composer");
const Vetement = require("../models/vetement");
const SousCategorie = require("../models/sousCategorie");
const Zone = require("../models/zone");

exports.trainModel = async (req, res, next) => {
  try {
    const evaluations = await Evaluation.findAll({
      where: { id_utilisateur: req.user.id }
    });

    const dataset = [];

    for (const evalItem of evaluations) {
      const compositions = await Composer.findAll({
        where: { id_tenue: evalItem.id_tenue }
      });

      const vetementIds = compositions.map(c => c.id_vetement);

      const vetements = await Vetement.findAll({
        where: { id_vetement: vetementIds },
        include: {
          model: SousCategorie,
          include: Zone
        }
      });

      const row = {
        temperature: evalItem.temperature,
        is_liked: evalItem.is_liked ? 1 : 0
      };

      for (const v of vetements) {
        const zoneName = v.sous_categorie.zone.nom_zone;
        row[`zone_${zoneName}`] = 1;
      }

      dataset.push(row);
    }

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

    const response = await axios.post("http://localhost:8000/predict", features);

    res.json(response.data);

  } catch (error) {
    next(error);
  }
};