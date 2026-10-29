jest.mock('../middlewares/auth', () => (req, res, next) => {
  if (!req.headers['x-test-role']) return res.sendStatus(401);
  req.user = { id: 1, role: req.headers['x-test-role'] }; next();
});
jest.mock('../controllers/vetementController', () => Object.fromEntries(
  ['create', 'getAllMine', 'getAll', 'getById', 'update', 'delete', 'updateById', 'deleteById']
    .map(name => [name, (req, res) => res.json({ handler: name, id: req.params.id })])
));
const request = require('supertest');
const app = require('express')();
app.use('/api/vetement', require('../routes/vetementRoutes'));
test('la route /all reste réservée aux administrateurs et atteint getAll', async () => {
  expect((await request(app).get('/api/vetement/all')).status).toBe(401);
  expect((await request(app).get('/api/vetement/all').set('x-test-role', 'user')).status).toBe(403);
  const result = await request(app).get('/api/vetement/all').set('x-test-role', 'admin');
  expect(result.status).toBe(200); expect(result.body.handler).toBe('getAll');
});
test('la lecture individuelle conserve sa route', async () => {
  const result = await request(app).get('/api/vetement/7').set('x-test-role', 'user');
  expect(result.body).toEqual({ handler: 'getById', id: '7' });
});
