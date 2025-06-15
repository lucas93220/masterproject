const express = require('express');
const router = express.Router();
const vetementController = require('../controllers/vetementController');
const auth = require('../middlewares/auth');
const admin = require('../middlewares/admin');

// User
router.post('/', auth, vetementController.create);
router.get('/', auth, vetementController.getAllMine);
router.get('/:id', auth, vetementController.getById);
router.put('/:id', auth, vetementController.update);
router.delete('/:id', auth, vetementController.delete);

// Admin
router.get('/all', auth, admin, vetementController.getAll);
router.put('/admin/:id', auth, admin, vetementController.updateById);
router.delete('/admin/:id', auth, admin, vetementController.deleteById);


module.exports = router;
