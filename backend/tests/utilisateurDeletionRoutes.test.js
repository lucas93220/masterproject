jest.mock('../models/utilisateur', () => ({ findByPk: jest.fn() }));
jest.mock('../services/erasureReceipts', () => ({ hasErasureReceipt: jest.fn(async () => false) }));
jest.mock('../services/accountDeletion', () => ({ deleteAccount: jest.fn() }));

const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { deleteAccount } = require('../services/accountDeletion');

describe('Routes de suppression de compte', () => {
  let app;
  let previousSecret;

  beforeAll(() => {
    previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'secret-test-suppression';
    app = express();
    app.use('/api/utilisateur', require('../routes/utilisateurRoutes'));
    app.use((error, req, res, next) =>
      res.status(error.status || 500).json({ message: error.message }));
  });

  afterAll(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    require('../models/utilisateur').findByPk.mockImplementation(async id =>
      ({ id_utilisateur: id, role: id === 1 ? 'admin' : 'user' }));
  });

  const token = (id, role = 'user') =>
    jwt.sign({ id, role }, process.env.JWT_SECRET);

  test('une session non authentifiée ne déclenche aucune suppression', async () => {
    expect((await request(app).delete('/api/utilisateur/me')).status).toBe(401);
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  test('le compte courant est issu du JWT et signale le nettoyage en attente', async () => {
    deleteAccount.mockResolvedValue({ status: 202, message: 'Nettoyage en attente' });
    const response = await request(app).delete('/api/utilisateur/me')
      .set('Authorization', `Bearer ${token(7)}`);
    expect(response.status).toBe(202);
    expect(response.body.message).toBe('Nettoyage en attente');
    expect(deleteAccount).toHaveBeenCalledWith(7);
  });

  test('un utilisateur normal ne peut supprimer autrui ; admin validé seulement', async () => {
    expect((await request(app).delete('/api/utilisateur/8')
      .set('Authorization', `Bearer ${token(7)}`)).status).toBe(403);
    expect(deleteAccount).not.toHaveBeenCalled();
    deleteAccount.mockResolvedValue({ status: 200, message: 'Supprimé' });
    expect((await request(app).delete('/api/utilisateur/8')
      .set('Authorization', `Bearer ${token(1, 'admin')}`)).status).toBe(200);
    expect(deleteAccount).toHaveBeenCalledWith(8);
    expect((await request(app).delete('/api/utilisateur/8e0')
      .set('Authorization', `Bearer ${token(1, 'admin')}`)).status).toBe(400);
  });
});
