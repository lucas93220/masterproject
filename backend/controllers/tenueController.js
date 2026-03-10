const Vetement = require('../models/vetement');
const SousCategorie = require('../models/sousCategorie');
const Zone = require('../models/zone');
const Dressing = require('../models/dressing');
const Contenir = require('../models/contenir');
const Tenue = require('../models/tenue');
const Composer = require('../models/composer');

exports.generateTenue = async (req, res, next) => {
  try {
    const temperature = req.query.temperature
  ? Math.round(Number(req.query.temperature))
  : null;

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
    const tenueFinale = [];

    for (const zone of zones) {

      const vetementsZone = vetementsFiltres.filter(v =>
        v.sous_categorie &&
        v.sous_categorie.zone &&
        v.sous_categorie.zone.id_zone === zone.id_zone
      );

      if (!vetementsZone.length) {
        if (zone.obligatoire) {
          return res.status(400).json({
            message: `Zone obligatoire manquante : ${zone.nom_zone}`
          });
        }
        continue;
      }

      const shuffled = vetementsZone.sort(() => 0.5 - Math.random());
      const selection = shuffled.slice(0, zone.max_elements);
      tenueFinale.push(...selection);
    }

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