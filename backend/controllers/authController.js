const { logAction } = require('../utils/logger');
const Utilisateur = require('../models/utilisateur');
const Dressing = require('../models/dressing');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');


// Inscription
exports.register = async (req, res, next) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { nom, prenom, ville, email, password, telephone, code_postal, role } = req.body;

    const existing = await Utilisateur.findOne({ where: { email } });
    if (existing) return res.status(409).json({ message: "Cet email est déjà utilisé." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await Utilisateur.create({
      nom, prenom, ville, email, telephone, code_postal, password: hashedPassword, role
    });

    await Dressing.create({ id_utilisateur: user.id_utilisateur });

    await logAction({
      userId: user.id_utilisateur,
      action: "register",
      details: { email, ip: req.ip }
    });

    const { password: _, ...userSafe } = user.dataValues;

    res.status(201).json({ user: userSafe });
  } catch (error) {
    next(error);
  }
};

// Connexion
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await Utilisateur.findOne({ where: { email } });
    if (!user) {
      await logAction({
        action: "login_failed",
        details: { email, reason: "not_found", ip: req.ip }
      });
    
      return res.status(401).json({ message: "Email ou mot de passe incorrect" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      await logAction({
        userId: user.id_utilisateur,
        action: "login_failed",
        details: { email, reason: "bad_password", ip: req.ip }
      });
      return res.status(401).json({ message: "Email ou mot de passe incorrect" });
    }

    const token = jwt.sign({ id: user.id_utilisateur, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });

    await logAction({
      userId: user.id_utilisateur,
      action: "login_success",
      details: { email, ip: req.ip }
    });

    const { password: _, ...userSafe } = user.dataValues;
    res.json({ user: userSafe, token });  } catch (error) {
    next(error);
  }
};
