const express = require('express');
const router = express.Router();
const utilisateurController = require('../controllers/utilisateurController');
const auth = require('../middlewares/auth');
const admin = require('../middlewares/admin')

router.get('/me', auth, utilisateurController.getMe);
router.put('/me', auth, utilisateurController.updateMe);
/**
 * @swagger
 * /api/utilisateur/me:
 *   delete:
 *     summary: Supprimer son propre compte utilisateur
 *     tags: [Utilisateur]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Compte supprimé avec succès
 *       401:
 *         description: Non authentifié ou accès refusé
 *       404:
 *         description: Utilisateur non trouvé
 */
router.delete('/me', auth, utilisateurController.deleteMe);

// Administration
router.delete('/:id', auth, admin, utilisateurController.deleteById);
router.get('/', auth, admin, utilisateurController.getAll);
router.get('/:id', auth, admin, utilisateurController.getById);
router.put('/:id', auth, admin, utilisateurController.updateById);
router.patch('/:id/role', auth, admin, utilisateurController.updateRole);




module.exports = router;
