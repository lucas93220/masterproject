const { getWeatherByCity } = require('../services/meteo');
const Utilisateur = require('../models/utilisateur');

exports.getWeatherForMe = async (req, res, next) => {
  try {
    const user = await Utilisateur.findByPk(req.user.id);
    if (!user || !user.ville) return res.status(400).json({ message: "Ville non renseignée dans le profil." });

    const weather = await getWeatherByCity(user.ville);
    res.json({ ville: user.ville, ...weather });
  } catch (error) {
    next(error);
  }
};

