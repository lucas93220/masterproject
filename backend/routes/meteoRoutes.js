const express = require('express');
const router = express.Router();
const meteoController = require('../controllers/meteoController');
const auth = require('../middlewares/auth');

router.get('/me', auth, meteoController.getWeatherForMe);

module.exports = router;
