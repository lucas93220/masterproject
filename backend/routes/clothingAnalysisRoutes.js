const express = require('express');
const auth = require('../middlewares/auth');
const { singleImage, imageType } = require('../middlewares/imageUpload');
const { createRecognitionLimit } = require('../middlewares/recognitionLimit');
const { configuration, RecognitionError } = require('../services/clothingRecognition');
const { identifyClothing } = require('../services/clothingIdentification');
const SousCategorie = require('../models/sousCategorie');

const router = express.Router();
const limit = createRecognitionLimit();

router.post('/', auth, (req, res, next) => {
  try { configuration(); next(); }
  catch (error) { res.status(error.status || 503).json({ message: error.message }); }
}, singleImage('image'), (req, res, next) => {
  if (!req.file) return res.status(400).json({ message: 'Aucune image envoyée' });
  if (!imageType(req.file)) return res.status(415).json({ message: 'Format image non pris en charge' });
  next();
}, limit, async (req, res) => {
  try {
    const catalog = await SousCategorie.findAll({
      attributes: ['id_sous_categorie', 'nom_sous_categorie'], raw: true
    });
    if (!catalog.length) return res.status(503).json({ message: 'Catalogue indisponible. Réessaie plus tard.' });
    const result = await identifyClothing(req.file, catalog);
    res.set('Cache-Control', 'no-store');
    return res.json(result);
  } catch (error) {
    if (error instanceof RecognitionError) return res.status(error.status).json({ message: error.message });
    return res.status(503).json({ message: 'Analyse photo indisponible. Tu peux continuer manuellement.' });
  } finally {
    res.locals.releaseRecognition();
  }
});

module.exports = router;
