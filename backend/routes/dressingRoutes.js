const express = require('express');
const router = express.Router();
const dressingController = require('../controllers/dressingController');
const auth = require('../middlewares/auth');

/**
 * @swagger
 * /api/dressing/me:
 *   get:
 *     summary: Obtenir tous ses vêtements (son dressing)
 *     tags: [Dressing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des vêtements de l'utilisateur connecté
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 dressing:
 *                   type: integer
 *                   description: ID du dressing
 *                 vetements:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id_vetement:
 *                         type: integer
 *                       marque:
 *                         type: string
 *                       nom:
 *                         type: string
 *                       photo:
 *                         type: string
 *                         nullable: true
 *                       couleur:
 *                         type: string
 *                       favori:
 *                         type: boolean
 *                       temperature_min:
 *                         type: integer
 *                       temperature_max:
 *                         type: integer
 *                       id_categorie:
 *                         type: integer
 *       401:
 *         description: Non authentifié
 */
router.get('/me', auth, dressingController.getMyDressing);

module.exports = router;
