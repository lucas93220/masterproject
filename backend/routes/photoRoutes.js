const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const photoController = require('../controllers/photoController');
const auth = require('../middlewares/auth'); // protège l’upload

router.post('/upload', auth, upload.single('photo'), photoController.upload); // upload = champ "photo"
router.get('/:id', photoController.getPhoto);

module.exports = router;
