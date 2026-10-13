const { postToMl } = require('../services/mlClient');
const Vetement = require('../models/vetement');
const SousCategorie = require('../models/sousCategorie');
const Zone = require('../models/zone');
const Dressing = require('../models/dressing');
const Contenir = require('../models/contenir');
const Tenue = require('../models/tenue');
const Composer = require('../models/composer');
const { loadFeatureSchema, extractFeatures } = require('../services/outfitFeatures');
const { buildRandomTenue } = require('../services/outfitCandidate');

exports.generateTenue = async (req, res, next) => {
  try {
    const rawTemperature = req.query.temperature;
    const temperature = rawTemperature !== undefined && rawTemperature !== '' &&
      Number.isFinite(Number(rawTemperature))
      ? Math.round(Number(rawTemperature)) : null;

    if (temperature === null) {
      return res.status(400).json({ message: "Température requise" });
    }

    const dressing = await Dressing.findOne({
      where: { id_utilisateur: req.user.id }
    });

    if (!dressing)
      return res.status(404).json({ message: "Dressing non trouvé" });

    const liens = await Contenir.findAll({
      where: { id_dressing: dressing.id_dressing }
    });

    const vetementIds = liens.map(l => l.id_vetement);

    if (!vetementIds.length)
      return res.status(400).json({ message: "Dressing vide" });

    const vetements = await Vetement.findAll({
      where: { id_vetement: vetementIds },
      include: {
        model: SousCategorie,
        include: {
          model: Zone
        }
      }
    });

    const vetementsFiltres = vetements.filter(v =>
      temperature >= v.temperature_min &&
      temperature <= v.temperature_max
    );

    if (!vetementsFiltres.length)
      return res.status(400).json({
        message: "Aucun vêtement compatible avec cette température"
      });

    const zones = await Zone.findAll();

    const candidates = [];
    const candidateKeys = new Set();

    for (let i = 0; i < 15 && candidates.length < 5; i++) {
      const candidate = buildRandomTenue(vetementsFiltres, zones, temperature);

      if (candidate) {
        const key = candidate.map(item => item.id_vetement).sort((a, b) => a - b).join(',');
        if (!candidateKeys.has(key)) {
          candidates.push(candidate);
          candidateKeys.add(key);
        }
      }
    }

    if (!candidates.length) {
      return res.status(400).json({
        message: "Impossible de générer des tenues valides"
      });
    }

    const schema = await loadFeatureSchema();

    let bestTenue = null;
    let bestScore = -1;

    for (const candidate of candidates) {

      const features = extractFeatures(candidate, temperature, schema);
      const response = await postToMl("predict", {
        ...features,
        feature_version: schema.version
      }, req.user.id);

      const score = response.data.probability_like;


      if (score > bestScore) {
        bestScore = score;
        bestTenue = candidate;
      }
    }

    const tenueFinale = bestTenue;

    const nouvelleTenue = await Tenue.create({
      id_utilisateur: req.user.id,
      temperature: temperature
    });

    await Promise.all(
      tenueFinale.map(v =>
        Composer.create({
          id_tenue: nouvelleTenue.id_tenue,
          id_vetement: v.id_vetement
        })
      )
    );

    return res.json({
      id_tenue: nouvelleTenue.id_tenue,
      vetements: tenueFinale
    });

  } catch (error) {
    next(error);
  }
};
