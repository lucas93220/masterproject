const express = require('express');
const router = express.Router();
const sousCategorieController = require('../controllers/sousCategorieController');
const auth = require('../middlewares/auth');
const admin = require('../middlewares/admin');

// Lire toutes les sous-catégories
router.get('/', auth, sousCategorieController.getAll);

router.get('/categorie/:id', sousCategorieController.getByCategorie);

// Ajouter une sous-catégorie (admin seulement)
router.post('/', auth, admin, sousCategorieController.create);

// Modifier une sous-catégorie (admin seulement)
router.put('/:id', auth, admin, sousCategorieController.update);

// Supprimer une sous-catégorie (admin seulement)
router.delete('/:id', auth, admin, sousCategorieController.delete);

module.exports = router;
