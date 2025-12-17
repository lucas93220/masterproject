const Evaluation = require('../models/evaluation');

// Evaluer une tenue
exports.create = async (req, res, next) => {
  try {
    const { id_tenue, is_liked } = req.body;
    const [evaluation, created] = await Evaluation.upsert({
      id_utilisateur: req.user.id,
      id_tenue,
      is_liked,
      date_avis: new Date()
    });
    res.status(201).json(evaluation);
  } catch (error) {
    next(error);
  }
};

// Voir ses évaluations
exports.getAllMine = async (req, res, next) => {
  try {
    const evaluations = await Evaluation.findAll({ where: { id_utilisateur: req.user.id } });
    res.json(evaluations);
  } catch (error) {
    next(error);
  }
};
