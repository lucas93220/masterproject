const Utilisateur = require('../models/utilisateur');

// Récupérer son profil utilisateur
exports.getMe = async (req, res, next) => {
  try {
    const user = await Utilisateur.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });
    res.json(user);
  } catch (error) {
    next(error);
  }
};

// Modifier son profil
exports.updateMe = async (req, res, next) => {
  try {
    const { nom, prenom, ville } = req.body;
    const user = await Utilisateur.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

    user.nom = nom ?? user.nom;
    user.prenom = prenom ?? user.prenom;
    user.ville = ville ?? user.ville;

    await user.save();

    const { password, ...userSafe } = user.dataValues;
    res.json(userSafe);
  } catch (error) {
    next(error);
  }
};

// Supprimer son compte
exports.deleteMe = async (req, res, next) => {
  try {
    const user = await Utilisateur.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

    await user.destroy();
    res.json({ message: "Compte supprimé avec succès." });
  } catch (error) {
    next(error);
  }
};

// Suppression par id (admin seulement)
exports.deleteById = async (req, res, next) => {
  try {
    const user = await Utilisateur.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

    await user.destroy();
    res.json({ message: "Utilisateur supprimé avec succès." });
  } catch (error) {
    next(error);
  }
};

// Dans controllers/utilisateurController.js
exports.getAll = async (req, res, next) => {
  try {
    const users = await Utilisateur.findAll({
      attributes: { exclude: ['password'] }
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
};

// Dans controllers/utilisateurController.js
exports.getById = async (req, res, next) => {
  try {
    const user = await Utilisateur.findByPk(req.params.id, {
      attributes: { exclude: ['password'] }
    });
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });
    res.json(user);
  } catch (error) {
    next(error);
  }
};

// Dans controllers/utilisateurController.js
exports.updateById = async (req, res, next) => {
  try {
    const { nom, prenom, ville, email } = req.body;
    const user = await Utilisateur.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

    user.nom = nom ?? user.nom;
    user.prenom = prenom ?? user.prenom;
    user.ville = ville ?? user.ville;
    user.email = email ?? user.email;

    await user.save();
    const { password, ...userSafe } = user.dataValues;
    res.json(userSafe);
  } catch (error) {
    next(error);
  }
};

// Dans controllers/utilisateurController.js
exports.updateRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const user = await Utilisateur.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

    user.role = role ?? user.role;
    await user.save();
    const { password, ...userSafe } = user.dataValues;
    res.json(userSafe);
  } catch (error) {
    next(error);
  }
};



