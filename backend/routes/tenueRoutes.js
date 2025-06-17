const express = require('express');
const router = express.Router();
const tenueController = require('../controllers/tenueController');
const auth = require('../middlewares/auth');

router.post('/', auth, tenueController.create);
router.get('/', auth, tenueController.getAllMine);
router.get('/:id', auth, tenueController.getById);

module.exports = router;
