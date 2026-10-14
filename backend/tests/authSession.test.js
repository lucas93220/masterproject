jest.mock('../models/utilisateur', () => ({ findByPk: jest.fn() }));
jest.mock('../services/erasureReceipts', () => ({ hasErasureReceipt: jest.fn(async () => false) }));
const jwt = require('jsonwebtoken');
const User = require('../models/utilisateur');
const auth = require('../middlewares/auth');
const original = process.env.JWT_SECRET;
beforeAll(() => { process.env.JWT_SECRET = 'test-session-secret'; });
afterAll(() => {
  if (original === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = original;
});
beforeEach(() => {
  jest.resetAllMocks();
  require('../services/erasureReceipts').hasErasureReceipt.mockResolvedValue(false);
});
function request(payload) {
  return { headers: { authorization: `Bearer ${jwt.sign(payload, process.env.JWT_SECRET)}` } };
}
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
test('un JWT valide ne réactive pas un compte supprimé', async () => {
  User.findByPk.mockResolvedValue(null);
  const res = response(), next = jest.fn();
  await auth(request({ id: 1 }), res, next);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});
test('un ancien rôle admin dans le JWT ne remplace pas le rôle SQL actuel', async () => {
  User.findByPk.mockResolvedValue({ id_utilisateur: 1, role: 'user' });
  const req = request({ id: 1, role: 'admin' }), next = jest.fn();
  await auth(req, response(), next);
  expect(req.user).toEqual({ id: 1, role: 'user' });
  expect(next).toHaveBeenCalledTimes(1);
});
test('base indisponible : refus temporaire sans révéler la connexion', async () => {
  User.findByPk.mockRejectedValue(new Error('secret-connexion'));
  const res = response(), next = jest.fn();
  await auth(request({ id: 1 }), res, next);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(JSON.stringify(res.json.mock.calls)).not.toContain('secret');
  expect(next).not.toHaveBeenCalled();
});
test.each([0, -1, '1', 1.5, 2147483648])('identité JWT invalide : %p', async id => {
  const res = response();
  await auth(request({ id }), res, jest.fn());
  expect(res.status).toHaveBeenCalledWith(401);
  expect(User.findByPk).not.toHaveBeenCalled();
});
