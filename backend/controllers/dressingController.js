const Dressing = require('../models/dressing');
const Contenir = require('../models/contenir');
const Vetement = require('../models/vetement');

exports.getMyDressing = async (req, res, next) => {
  try {
    const dressing = await Dressing.findOne({ where: { id_utilisateur: req.user.id } });
    if (!dressing) return res.status(404).json({ message: "Dressing non trouvé" });

    const liens = await Contenir.findAll({ where: { id_dressing: dressing.id_dressing } });
    const vetementIds = liens.map(link => link.id_vetement);

    const vetements = await Vetement.findAll({ where: { id_vetement: vetementIds } });

    res.json({ dressing: dressing.id_dressing, vetements });
  } catch (error) {
    next(error);
  }
};
