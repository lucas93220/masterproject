const express = require('express');
const router = express.Router();
const meteoController = require('../controllers/meteoController');
const auth = require('../middlewares/auth');

/**
 * @swagger
 * /api/meteo/me:
 *   get:
 *     summary: Obtenir la météo pour la ville de l'utilisateur connecté
 *     tags: [Météo]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Données météo de la ville de l'utilisateur
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ville:
 *                   type: string
 *                 temperature:
 *                   type: number
 *                 description:
 *                   type: string
 *                 meteo:
 *                   type: object
 *                   description: Données météo brutes (optionnel)
 *       401:
 *         description: Non authentifié
 *       404:
 *         description: Ville non renseignée
 */
router.get('/me', auth, meteoController.getWeatherForMe);

module.exports = router;
