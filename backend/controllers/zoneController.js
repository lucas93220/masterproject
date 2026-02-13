const Zone = require('../models/zone');

// Lire toutes les zones
exports.getAll = async (req, res, next) => {
  try {
    const zones = await Zone.findAll({
      order: [['id_zone', 'ASC']]
    });
    res.json(zones);
  } catch (error) {
    next(error);
  }
};

// Ajouter une zone (admin)
exports.create = async (req, res, next) => {
  try {
    const { nom_zone, max_elements, obligatoire } = req.body;

    const zone = await Zone.create({
      nom_zone,
      max_elements,
      obligatoire
    });

    res.status(201).json(zone);
  } catch (error) {
    next(error);
  }
};

// Modifier une zone (admin)
exports.update = async (req, res, next) => {
  try {
    const zone = await Zone.findByPk(req.params.id);
    if (!zone) {
      return res.status(404).json({ message: "Zone non trouvée" });
    }

    zone.nom_zone = req.body.nom_zone ?? zone.nom_zone;
    zone.max_elements = req.body.max_elements ?? zone.max_elements;
    zone.obligatoire = req.body.obligatoire ?? zone.obligatoire;

    await zone.save();
    res.json(zone);
  } catch (error) {
    next(error);
  }
};

// Supprimer une zone (admin)
exports.delete = async (req, res, next) => {
  try {
    const zone = await Zone.findByPk(req.params.id);
    if (!zone) {
      return res.status(404).json({ message: "Zone non trouvée" });
    }

    await zone.destroy();
    res.json({ message: "Zone supprimée avec succès." });
  } catch (error) {
    next(error);
  }
};
