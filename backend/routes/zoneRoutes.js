const express = require('express');
const router = express.Router();
const zoneController = require('../controllers/zoneController');
const auth = require('../middlewares/auth');
const admin = require('../middlewares/admin');

// Lire toutes les zones
router.get('/', auth, zoneController.getAll);

// Ajouter une zone 
router.post('/', auth, admin, zoneController.create);

// Modifier une zone
router.put('/:id', auth, admin, zoneController.update);

// Supprimer une zone
router.delete('/:id', auth, admin, zoneController.delete);

module.exports = router;
