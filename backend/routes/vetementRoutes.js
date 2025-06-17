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
/**
 * @swagger
 * /api/vetement/{id}:
 *   delete:
 *     summary: Supprimer un vêtement de son dressing
 *     tags: [Vetement]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID du vêtement à supprimer
 *     responses:
 *       200:
 *         description: Vêtement supprimé avec succès
 *       401:
 *         description: Non authentifié ou accès refusé
 *       404:
 *         description: Vêtement non trouvé
 */
router.delete('/:id', auth, vetementController.delete);

// Admin
router.get('/all', auth, admin, vetementController.getAll);
router.put('/admin/:id', auth, admin, vetementController.updateById);
router.delete('/admin/:id', auth, admin, vetementController.deleteById);


module.exports = router;
