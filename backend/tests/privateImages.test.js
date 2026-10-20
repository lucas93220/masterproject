jest.mock('../models/utilisateur', () => ({ findByPk: jest.fn() }));
jest.mock('../services/erasureReceipts', () => ({ hasErasureReceipt: jest.fn(async () => false) }));
jest.mock('../config/db', () => ({ sequelize: { query: jest.fn() } }));
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/utilisateur');
const { sequelize } = require('../config/db');
const { canReadImage } = require('../services/imageAccess');
const filename = 'u1_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg';
const legacy = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.jpg';
const timestampLegacy = '1760961600000-abcde.jpg';
let app, root;
const originalDir = process.env.FITS_UPLOAD_DIR, originalSecret = process.env.JWT_SECRET;
beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'fits-private-images-'));
  process.env.FITS_UPLOAD_DIR = root;
  process.env.JWT_SECRET = 'private-images-test';
  await fs.writeFile(path.join(root, filename), 'fixture-image');
  await fs.writeFile(path.join(root, legacy), 'legacy-fixture');
  await fs.writeFile(path.join(root, timestampLegacy), 'timestamp-legacy-fixture');
  app = express();
  app.use('/uploads', require('../routes/privateImageRoutes'));
});
afterAll(async () => {
  if (originalDir === undefined) delete process.env.FITS_UPLOAD_DIR;
  else process.env.FITS_UPLOAD_DIR = originalDir;
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
  await fs.rm(root, { recursive: true, force: true });
});
beforeEach(() => {
  jest.clearAllMocks();
  User.findByPk.mockImplementation(async id => ({ id_utilisateur: id, role: 'user' }));
});
const get = (name, id = 1) => request(app).get(`/uploads/${name}`)
  .set('Authorization', `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`);
test('une image connue n’est lisible que par son propriétaire, sans cache public', async () => {
  expect((await request(app).get(`/uploads/${filename}`)).status).toBe(401);
  expect((await get(filename, 2)).status).toBe(404);
  const result = await get(filename);
  expect(result.status).toBe(200);
  expect(result.headers['cache-control']).toBe('private, no-store');
  expect(result.headers.vary).toContain('Authorization');
  User.findByPk.mockResolvedValue(null);
  expect((await get(filename)).status).toBe(401);
});
test('une ancienne image requiert une relation SQL appartenant au compte', async () => {
  sequelize.query.mockResolvedValue([]);
  expect((await get(legacy)).status).toBe(404);
  sequelize.query.mockResolvedValue([{ '?column?': 1 }]);
  expect((await get(legacy)).status).toBe(200);
  expect(sequelize.query).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({
    replacements: { userId: 1, suffix: `%/uploads/${legacy}` }
  }));
});
test('un ancien nom horodaté reste privé et lisible seulement via le dressing', async () => {
  expect((await request(app).get(`/uploads/${timestampLegacy}`)).status).toBe(401);
  sequelize.query.mockResolvedValue([]);
  expect((await get(timestampLegacy, 2)).status).toBe(404);
  sequelize.query.mockResolvedValue([{ '?column?': 1 }]);
  expect((await get(timestampLegacy)).status).toBe(200);
  expect(sequelize.query).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({
    replacements: { userId: 1, suffix: `%/uploads/${timestampLegacy}` }
  }));
});
test('refuse les chemins et liens symboliques sans lire leur cible', async () => {
  expect(await canReadImage(1, '../secret.jpg')).toBe(false);
  expect(await canReadImage(1, 'u1_not-an-uuid.jpg')).toBe(false);
  expect(await canReadImage(1, '1760961600000-abcde.jpg.bak')).toBe(false);
  const link = 'u1_cccccccc-cccc-cccc-cccc-cccccccccccc.jpg';
  await fs.symlink(path.join(root, filename), path.join(root, link));
  expect((await get(link)).status).toBe(404);
  expect((await get(filename)).status).toBe(200);
});
