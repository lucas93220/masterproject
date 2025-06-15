const Categorie = require('../models/categorie');

// Lire toutes les catégories
exports.getAll = async (req, res, next) => {
  try {
    const categories = await Categorie.findAll();
    res.json(categories);
  } catch (error) {
    next(error);
  }
};

// Ajouter une catégorie (admin)
exports.create = async (req, res, next) => {
  try {
    const { nom_categorie } = req.body;
    const categorie = await Categorie.create({ nom_categorie });
    res.status(201).json(categorie);
  } catch (error) {
    next(error);
  }
};

// Modifier une catégorie (admin)
exports.update = async (req, res, next) => {
  try {
    const categorie = await Categorie.findByPk(req.params.id);
    if (!categorie) return res.status(404).json({ message: "Catégorie non trouvée" });

    categorie.nom_categorie = req.body.nom_categorie ?? categorie.nom_categorie;
    await categorie.save();
    res.json(categorie);
  } catch (error) {
    next(error);
  }
};

// Supprimer une catégorie (admin)
exports.delete = async (req, res, next) => {
  try {
    const categorie = await Categorie.findByPk(req.params.id);
    if (!categorie) return res.status(404).json({ message: "Catégorie non trouvée" });

    await categorie.destroy();
    res.json({ message: "Catégorie supprimée avec succès." });
  } catch (error) {
    next(error);
  }
};
