jest.mock('../models/utilisateur', () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock('../models/dressing', () => ({ create: jest.fn() }));
jest.mock('../utils/logger', () => ({ logAction: jest.fn() }));
jest.mock('bcryptjs', () => ({ hash: jest.fn(), compare: jest.fn() }));
jest.mock('express-validator', () => ({ validationResult: () => ({ isEmpty: () => true }) }));
jest.mock('../config/db', () => {
  throw new Error('Ce test ne doit pas ouvrir de connexion à la base');
});

const Utilisateur = require('../models/utilisateur');
const Dressing = require('../models/dressing');
const { logAction } = require('../utils/logger');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const controller = require('../controllers/authController');
const admin = require('../middlewares/admin');

describe('Inscription publique sans base de données', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Utilisateur.findOne.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue('hachage-fictif');
    Utilisateur.create.mockImplementation(async data => ({
      id_utilisateur: 12, role: data.role, dataValues: { id_utilisateur: 12, ...data }
    }));
    Dressing.create.mockResolvedValue({});
    logAction.mockResolvedValue();
  });

  test.each(['admin', 'user', undefined])('attribue toujours user même si role=%p est fourni', async role => {
    const req = { body: { nom: 'Test', prenom: 'Compte', email: 'test@example.invalid',
      password: 'fictif', role }, ip: '127.0.0.1' };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await controller.register(req, res, next);

    expect(Utilisateur.create).toHaveBeenCalledWith(expect.objectContaining({ role: 'user' }));
    expect(Dressing.create).toHaveBeenCalledWith({ id_utilisateur: 12 });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ user: expect.objectContaining({ role: 'user' }) });
    expect(res.json.mock.calls[0][0].user).not.toHaveProperty('password');
    expect(next).not.toHaveBeenCalled();
  });

  test('le refus d’un email déjà utilisé ne crée aucun compte', async () => {
    Utilisateur.findOne.mockResolvedValue({ id_utilisateur: 1 });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.register({ body: { email: 'test@example.invalid' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(409);
    expect(Utilisateur.create).not.toHaveBeenCalled();
    expect(Dressing.create).not.toHaveBeenCalled();
  });

  test('un role=admin demandé à l’inscription donne un JWT user refusé par la route admin', async () => {
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'secret-jwt-test';
    try {
      const body = { nom: 'Test', prenom: 'Compte', email: 'test@example.invalid',
        password: 'fictif', role: 'admin' };
      const registerResponse = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await controller.register({ body, ip: '127.0.0.1' }, registerResponse, jest.fn());
      const created = await Utilisateur.create.mock.results[0].value;
      Utilisateur.findOne.mockResolvedValue({ ...created, password: 'hachage-fictif' });
      bcrypt.compare.mockResolvedValue(true);
      const loginResponse = { json: jest.fn() };
      await controller.login({ body: { email: body.email, password: body.password },
        ip: '127.0.0.1' }, loginResponse, jest.fn());
      const claims = jwt.verify(loginResponse.json.mock.calls[0][0].token,
        process.env.JWT_SECRET);
      expect(claims.role).toBe('user');
      const adminResponse = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      admin({ user: claims }, adminResponse, next);
      expect(adminResponse.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    } finally {
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
    }
  });
});
