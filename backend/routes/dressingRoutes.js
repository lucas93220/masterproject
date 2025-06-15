const express = require('express');
const router = express.Router();
const dressingController = require('../controllers/dressingController');
const auth = require('../middlewares/auth');

router.get('/me', auth, dressingController.getMyDressing);

module.exports = router;
