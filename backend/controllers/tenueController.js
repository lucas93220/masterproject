const Vetement = require('../models/vetement');
const SousCategorie = require('../models/sousCategorie');
const Zone = require('../models/zone');
const Dressing = require('../models/dressing');
const Contenir = require('../models/contenir');

exports.generateTenue = async (req, res, next) => {
  try {
    const temperature = req.query.temperature
      ? Number(req.query.temperature)
      : null;

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

    const vetementsFiltres = temperature !== null
      ? vetements.filter(v =>
          temperature >= v.temperature_min &&
          temperature <= v.temperature_max
        )
      : vetements;

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

    return res.json(tenueFinale);

  } catch (error) {
    next(error);
  }
};
