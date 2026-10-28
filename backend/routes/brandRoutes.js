const express = require('express');
const auth = require('../middlewares/auth');
const Vetement = require('../models/vetement');
const { brandCatalogue } = require('../services/clothingBrands');

const router = express.Router();
router.get('/', auth, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const rows = await Vetement.findAll({
      attributes: ['marque'], where: { id_utilisateur: req.user.id },
      group: ['marque'], order: [['marque', 'ASC']]
    });
    return res.json({ brands: brandCatalogue(rows.map(row => row.marque)), personalAvailable: true });
  } catch {
    // Le catalogue commun reste utilisable si les marques personnelles ne sont pas joignables.
    return res.json({ brands: brandCatalogue(), personalAvailable: false });
  }
});

module.exports = router;
