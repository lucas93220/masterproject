const axios = require("axios");
const Evaluation = require("../models/evaluation");
const Tenue = require("../models/tenue");
const Composer = require("../models/composer");
const Vetement = require("../models/vetement");
const SousCategorie = require("../models/sousCategorie");
const Zone = require("../models/zone");

exports.trainModel = async (req, res, next) => {
  try {
    // 1️⃣ Récupérer toutes les zones une seule fois
    const allZones = await Zone.findAll();

    // 2️⃣ Récupérer toutes les évaluations de l'utilisateur
    const evaluations = await Evaluation.findAll({
      where: { id_utilisateur: req.user.id }
    });

    const dataset = [];

    for (const evalItem of evaluations) {
      // 3️⃣ Récupérer les vêtements de la tenue
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

      // 4️⃣ Calcul features globales
      const nb_vetements = vetements.length;
      const nb_favoris = vetements.filter(v => v.favori).length;
      const ratio_favoris =
        nb_vetements > 0 ? nb_favoris / nb_vetements : 0;

      const row = {
        temperature: evalItem.temperature,
        nb_vetements,
        nb_favoris,
        ratio_favoris,
        is_liked: evalItem.is_liked ? 1 : 0
      };

      // 5️⃣ Initialiser toutes les zones à 0
      for (const zone of allZones) {
        row[`zone_${zone.nom_zone}`] = 0;
      }

      // 6️⃣ Mettre à 1 les zones réellement présentes
      for (const v of vetements) {
        const zoneName = v.sous_categorie.zone.nom_zone;
        row[`zone_${zoneName}`] = 1;
      }

      dataset.push(row);
    }

    // 7️⃣ Envoi au microservice ML
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