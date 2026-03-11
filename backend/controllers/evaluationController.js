const Evaluation = require('../models/evaluation');
const Tenue = require('../models/tenue');

exports.create = async (req, res, next) => {
  try {
    const { id_tenue, is_liked } = req.body;

    const tenue = await Tenue.findByPk(id_tenue);

    if (!tenue) {
      return res.status(404).json({ message: "Tenue introuvable" });
    }

    const [evaluation] = await Evaluation.upsert({
      id_utilisateur: req.user.id,
      id_tenue,
      is_liked,
      temperature: tenue.temperature,
      date_avis: new Date()
    });

    res.status(201).json(evaluation);

  } catch (error) {
    next(error);
  }
};