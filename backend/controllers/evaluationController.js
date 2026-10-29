const axios = require("axios");
const { mlTimeout } = require('../services/mlTimeout');
const Evaluation = require("../models/evaluation");
const Tenue = require("../models/tenue");
const Composer = require("../models/composer");
const Vetement = require("../models/vetement");
const SousCategorie = require("../models/sousCategorie");
const Zone = require("../models/zone");
const { loadFeatureSchema, snapshotGarment } = require("../services/outfitFeatures");

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

    if (!Number.isInteger(tenue.temperature)) {
      return res.status(409).json({ message: "Température de la tenue indisponible" });
    }

    let featureSnapshot;
    try {
      const compositions = await Composer.findAll({ where: { id_tenue } });
      const ids = compositions.map(item => item.id_vetement);
      if (!ids.length || new Set(ids).size !== ids.length) {
        return res.status(409).json({ message: "Composition de tenue invalide" });
      }

      const [garments, schema] = await Promise.all([
        Vetement.findAll({
          where: { id_vetement: ids },
          include: { model: SousCategorie, include: Zone }
        }),
        loadFeatureSchema()
      ]);
      const byId = new Map(garments.map(item => [item.id_vetement, item]));
      if (!ids.every(id => byId.has(id))) {
        return res.status(409).json({ message: "Composition de tenue invalide" });
      }
      featureSnapshot = { version: schema.v3 ? 3 : 2,
        garments: ids.map(id => ({ id_vetement: id,
          ...snapshotGarment(byId.get(id), schema) })) };
    } catch (snapshotError) {
      return res.status(503).json({ message: "Évaluation temporairement indisponible" });
    }

    const [evaluation] = await Evaluation.upsert({
      id_utilisateur: req.user.id,
      id_tenue,
      is_liked,
      temperature: tenue.temperature,
      date_avis: new Date(),
      feature_snapshot: featureSnapshot
    });

    try {
      const trainResponse = await axios.post(`http://127.0.0.1:${process.env.PORT || 3002}/api/ml/train`, {}, {
        timeout: mlTimeout('train') + 1000,
        headers: {
          Authorization: req.headers.authorization
        }
      });
      if (trainResponse.data.status === "insufficient_data") {
        console.log("Données insuffisantes pour réentraîner le modèle");
      } else {
        console.log("Modèle réentraîné automatiquement");
      }
    } catch (trainError) {
      console.log("Erreur retrain (non bloquante) :", trainError.message);
    }

    res.status(201).json(evaluation);

  } catch (error) {
    next(error);
  }
};
