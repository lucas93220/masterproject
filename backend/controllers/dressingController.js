const Dressing = require('../models/dressing');
const Contenir = require('../models/contenir');
const Vetement = require('../models/vetement');
const SousCategorie = require('../models/sousCategorie');
const Categorie = require('../models/categorie');
const Zone = require('../models/zone');

exports.getMyDressing = async (req, res, next) => {
  try {
    const dressing = await Dressing.findOne({
      where: { id_utilisateur: req.user.id }
    });

    if (!dressing) {
      return res.status(404).json({ message: "Dressing non trouvé" });
    }

    const liens = await Contenir.findAll({
      where: { id_dressing: dressing.id_dressing }
    });

    const vetementIds = liens.map(link => link.id_vetement);

    if (vetementIds.length === 0) {
      return res.json({
        dressing: dressing.id_dressing,
        vetements: []
      });
    }

    const vetements = await Vetement.findAll({
      where: { id_vetement: vetementIds },
      include: [
        {
          model: SousCategorie,
          include: [
            {
              model: Categorie
            },
            {
              model: Zone
            }
          ]
        }
      ]
    });

    res.json({
      dressing: dressing.id_dressing,
      vetements
    });

  } catch (error) {
    next(error);
  }
};
