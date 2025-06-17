const Tenue = require('../models/tenue');
const Composer = require('../models/composer');
const Vetement = require('../models/vetement');

// Créer une tenue (avec une liste de vêtements)
exports.create = async (req, res, next) => {
  try {
    const { vetements } = req.body; // array d'id_vetement
    const tenue = await Tenue.create({
      id_utilisateur: req.user.id
    });
    // Ajoute chaque vêtement à la tenue via composer
    await Promise.all(
      vetements.map(id_vetement =>
        Composer.create({ id_tenue: tenue.id_tenue, id_vetement })
      )
    );
    res.status(201).json({ tenue, vetements });
  } catch (error) {
    next(error);
  }
};

// Lire toutes ses tenues
exports.getAllMine = async (req, res, next) => {
  try {
    const tenues = await Tenue.findAll({
      where: { id_utilisateur: req.user.id }
    });
    res.json(tenues);
  } catch (error) {
    next(error);
  }
};

// Lire une tenue précise (avec ses vêtements)
exports.getById = async (req, res, next) => {
  try {
    const tenue = await Tenue.findOne({
      where: { id_tenue: req.params.id, id_utilisateur: req.user.id }
    });
    if (!tenue) return res.status(404).json({ message: "Tenue non trouvée" });

    const compositions = await Composer.findAll({ where: { id_tenue: tenue.id_tenue } });
    const vetementIds = compositions.map(c => c.id_vetement);
    const vetements = await Vetement.findAll({ where: { id_vetement: vetementIds } });

    res.json({ tenue, vetements });
  } catch (error) {
    next(error);
  }
};

