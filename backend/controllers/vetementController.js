const Vetement = require('../models/vetement');
const Dressing = require('../models/dressing');
const Contenir = require('../models/contenir');
const SousCategorie = require('../models/sousCategorie');
const Categorie = require('../models/categorie');
const Zone = require('../models/zone');


// =========================
// Créer un vêtement
// =========================
exports.create = async (req, res, next) => {
  try {
    const dressing = await Dressing.findOne({
      where: { id_utilisateur: req.user.id }
    });

    if (!dressing)
      return res.status(404).json({ message: "Dressing non trouvé" });

    const {
      marque,
      nom,
      photo,
      couleur,
      favori,
      temperature_min,
      temperature_max,
      id_sous_categorie
    } = req.body;

    const vetement = await Vetement.create({
      marque,
      nom,
      photo,
      couleur,
      favori: favori ?? false,
      temperature_min,
      temperature_max,
      id_sous_categorie
    });

    await Contenir.create({
      id_dressing: dressing.id_dressing,
      id_vetement: vetement.id_vetement
    });

    res.status(201).json(vetement);
  } catch (error) {
    next(error);
  }
};


// =========================
// Lire tous les vêtements de l'utilisateur
// =========================
exports.getAllMine = async (req, res, next) => {
  try {
    const dressing = await Dressing.findOne({
      where: { id_utilisateur: req.user.id }
    });

    if (!dressing)
      return res.status(404).json({ message: "Dressing non trouvé" });

    const liens = await Contenir.findAll({
      where: { id_dressing: dressing.id_dressing }
    });

    const vetementIds = liens.map(link => link.id_vetement);

    const vetements = await Vetement.findAll({
      where: { id_vetement: vetementIds },
      include: {
        model: SousCategorie,
        include: [
          { model: Categorie },
          { model: Zone }
        ]
      }
    });

    res.json(vetements);
  } catch (error) {
    next(error);
  }
};


// =========================
// Lire un vêtement précis
// =========================
exports.getById = async (req, res, next) => {
  try {
    const dressing = await Dressing.findOne({
      where: { id_utilisateur: req.user.id }
    });

    if (!dressing)
      return res.status(404).json({ message: "Dressing non trouvé" });

    const relation = await Contenir.findOne({
      where: {
        id_dressing: dressing.id_dressing,
        id_vetement: req.params.id
      }
    });

    if (!relation)
      return res.status(404).json({
        message: "Ce vêtement ne vous appartient pas."
      });

    const vetement = await Vetement.findByPk(req.params.id, {
      include: {
        model: SousCategorie,
        include: [
          { model: Categorie },
          { model: Zone }
        ]
      }
    });

    if (!vetement)
      return res.status(404).json({ message: "Vêtement non trouvé" });

    res.json(vetement);
  } catch (error) {
    next(error);
  }
};


// =========================
// Modifier un vêtement
// =========================
exports.update = async (req, res, next) => {
  try {
    const dressing = await Dressing.findOne({
      where: { id_utilisateur: req.user.id }
    });

    if (!dressing)
      return res.status(404).json({ message: "Dressing non trouvé" });

    const relation = await Contenir.findOne({
      where: {
        id_dressing: dressing.id_dressing,
        id_vetement: req.params.id
      }
    });

    if (!relation)
      return res.status(404).json({
        message: "Ce vêtement ne vous appartient pas."
      });

    const vetement = await Vetement.findByPk(req.params.id);

    if (!vetement)
      return res.status(404).json({ message: "Vêtement non trouvé" });

    Object.assign(vetement, req.body);
    await vetement.save();

    res.json(vetement);
  } catch (error) {
    next(error);
  }
};


// =========================
// Supprimer un vêtement
// =========================
exports.delete = async (req, res, next) => {
  try {
    const dressing = await Dressing.findOne({
      where: { id_utilisateur: req.user.id }
    });

    if (!dressing)
      return res.status(404).json({ message: "Dressing introuvable" });

    const relation = await Contenir.findOne({
      where: {
        id_dressing: dressing.id_dressing,
        id_vetement: req.params.id
      }
    });

    if (!relation)
      return res.status(404).json({
        message: "Ce vêtement ne vous appartient pas."
      });

    await relation.destroy();

    res.json({ message: "Vêtement supprimé avec succès." });
  } catch (error) {
    next(error);
  }
};


// =========================
// ADMIN
// =========================
exports.getAll = async (req, res, next) => {
  try {
    const vetements = await Vetement.findAll({
      include: {
        model: SousCategorie,
        include: [
          { model: Categorie },
          { model: Zone }
        ]
      }
    });

    res.json(vetements);
  } catch (error) {
    next(error);
  }
};

exports.updateById = async (req, res, next) => {
  try {
    const vetement = await Vetement.findByPk(req.params.id);

    if (!vetement)
      return res.status(404).json({ message: "Vêtement non trouvé" });

    Object.assign(vetement, req.body);
    await vetement.save();

    res.json(vetement);
  } catch (error) {
    next(error);
  }
};

exports.deleteById = async (req, res, next) => {
  try {
    const vetement = await Vetement.findByPk(req.params.id);

    if (!vetement)
      return res.status(404).json({ message: "Vêtement non trouvé" });

    await vetement.destroy();

    res.json({ message: "Vêtement supprimé avec succès (admin)." });
  } catch (error) {
    next(error);
  }
};
