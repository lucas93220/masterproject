const express = require('express');
const router = express.Router();
const tenueController = require('../controllers/tenueController');
const auth = require('../middlewares/auth');

router.get('/generate', auth, tenueController.generateTenue);

module.exports = router;
