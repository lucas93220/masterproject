const express = require('express');
const router = express.Router();
const { singleImage } = require('../middlewares/imageUpload');
const photoController = require('../controllers/photoController');
const auth = require('../middlewares/auth');

router.post('/upload', auth, singleImage('photo'), photoController.upload);
router.get('/:id', auth, photoController.getPhoto);

module.exports = router;
