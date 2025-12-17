const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Inscription utilisateur
 *     tags: [Inscription]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nom:
 *                 type: string
 *               prenom:
 *                 type: string
 *               ville:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *     responses:
 *       201:
 *         description: Compte créé
 *       409:
 *         description: Email déjà utilisé
 */
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Email invalide'),
    // body('password').isLength({ min: 6 }).withMessage('Mot de passe trop court'),
    body('nom').notEmpty().withMessage('Le nom est requis'),
    body('prenom').notEmpty().withMessage('Le prénom est requis')
  ],
  authController.register
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Connexion utilisateur
 *     tags: [Connexion]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Connexion réussie
 *       401:
 *         description: Email ou mot de passe incorrect
 *       404:
 *         description: Utilisateur introuvable
 */
router.post('/login', authController.login);

module.exports = router;
