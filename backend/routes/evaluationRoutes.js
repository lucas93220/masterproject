const express = require('express');
const router = express.Router();
const evaluationController = require('../controllers/evaluationController');
const auth = require('../middlewares/auth');

router.post('/', auth, evaluationController.create);
router.get('/', auth, evaluationController.getAllMine);

module.exports = router;
