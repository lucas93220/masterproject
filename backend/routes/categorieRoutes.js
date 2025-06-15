const express = require('express');
const router = express.Router();
const categorieController = require('../controllers/categorieController');
const auth = require('../middlewares/auth');
const admin = require('../middlewares/admin');

router.get('/', auth, categorieController.getAll);
router.post('/', auth, admin, categorieController.create);
router.put('/:id', auth, admin, categorieController.update);
router.delete('/:id', auth, admin, categorieController.delete);

module.exports = router;
