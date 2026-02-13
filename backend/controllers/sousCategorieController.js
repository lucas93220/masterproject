const SousCategorie = require('../models/sousCategorie');
const Categorie = require('../models/categorie');
const Zone = require('../models/zone');

exports.getByCategorie = async (req, res, next) => {
  try {
    const sousCategories = await SousCategorie.findAll({
      where: { id_categorie: req.params.id }
    });

    res.json(sousCategories);
  } catch (error) {
    next(error);
  }
};


// Lire toutes les sous-catégories
exports.getAll = async (req, res, next) => {
  try {
    const sousCategories = await SousCategorie.findAll({
      include: [
        {
          model: Categorie,
          attributes: ['id_categorie', 'nom_categorie']
        },
        {
          model: Zone,
          attributes: ['id_zone', 'nom_zone', 'max_elements', 'obligatoire']
        }
      ],
      order: [['id_sous_categorie', 'ASC']]
    });

    res.json(sousCategories);
  } catch (error) {
    next(error);
  }
};

// Ajouter une sous-catégorie (admin)
exports.create = async (req, res, next) => {
  try {
    const { nom_sous_categorie, id_categorie, id_zone } = req.body;

    const sousCategorie = await SousCategorie.create({
      nom_sous_categorie,
      id_categorie,
      id_zone
    });

    res.status(201).json(sousCategorie);
  } catch (error) {
    next(error);
  }
};

// Modifier une sous-catégorie (admin)
exports.update = async (req, res, next) => {
  try {
    const sousCategorie = await SousCategorie.findByPk(req.params.id);
    if (!sousCategorie) {
      return res.status(404).json({ message: "Sous-catégorie non trouvée" });
    }

    sousCategorie.nom_sous_categorie =
      req.body.nom_sous_categorie ?? sousCategorie.nom_sous_categorie;

    sousCategorie.id_categorie =
      req.body.id_categorie ?? sousCategorie.id_categorie;

    sousCategorie.id_zone =
      req.body.id_zone ?? sousCategorie.id_zone;

    await sousCategorie.save();

    res.json(sousCategorie);
  } catch (error) {
    next(error);
  }
};

// Supprimer une sous-catégorie (admin)
exports.delete = async (req, res, next) => {
  try {
    const sousCategorie = await SousCategorie.findByPk(req.params.id);
    if (!sousCategorie) {
      return res.status(404).json({ message: "Sous-catégorie non trouvée" });
    }

    await sousCategorie.destroy();
    res.json({ message: "Sous-catégorie supprimée avec succès." });
  } catch (error) {
    next(error);
  }
};
