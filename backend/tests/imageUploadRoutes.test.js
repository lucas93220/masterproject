jest.mock('../models/photo', () => ({ create: jest.fn(), findOne: jest.fn() }));
jest.mock('../config/db', () => {
  throw new Error('Ce test ne doit pas ouvrir de connexion à la base');
});

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const Photo = require('../models/photo');
const { MAX_IMAGE_BYTES, onlyImageFiles } = require('../middlewares/imageUpload');

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

describe('Uploads isolés (répertoire temporaire et modèle Mongo simulé)', () => {
  let app;
  let uploadDir;
  let token;
  let previousSecret;
  let previousDir;

  beforeAll(async () => {
    uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fits-uploads-test-'));
    previousSecret = process.env.JWT_SECRET;
    previousDir = process.env.FITS_UPLOAD_DIR;
    process.env.JWT_SECRET = 'secret-uniquement-pour-test';
    process.env.FITS_UPLOAD_DIR = uploadDir;
    token = jwt.sign({ id: 1, role: 'user' }, process.env.JWT_SECRET);
    app = express();
    app.use('/api/upload', require('../routes/uploadRoutes'));
    app.use('/api/photo', require('../routes/photoRoutes'));
    app.use('/uploads', onlyImageFiles, express.static(uploadDir));
    app.use((error, req, res, next) => res.status(500).json({ message: error.message }));
  });

  afterAll(async () => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    if (previousDir === undefined) delete process.env.FITS_UPLOAD_DIR;
    else process.env.FITS_UPLOAD_DIR = previousDir;
    await fs.rm(uploadDir, { recursive: true, force: true });
  });

  beforeEach(() => jest.clearAllMocks());

  const authorized = req => req.set('Authorization', `Bearer ${token}`);

  test('refuse les deux uploads sans authentification avant tout stockage', async () => {
    expect((await request(app).post('/api/upload').attach('image', jpeg, 'photo.jpg')).status).toBe(401);
    expect((await request(app).post('/api/photo/upload').attach('photo', jpeg, 'photo.jpg')).status).toBe(401);
    expect(await fs.readdir(uploadDir)).toEqual([]);
    expect(Photo.create).not.toHaveBeenCalled();
  });

  test('enregistre un JPEG valide sous un nom aléatoire sans exposer le nom client', async () => {
    const response = await authorized(request(app).post('/api/upload'))
      .attach('image', jpeg, { filename: '../nom-client.jpg', contentType: 'image/jpeg' });
    expect(response.status).toBe(200);
    const url = new URL(response.body.imageUrl);
    expect(url.pathname).toMatch(/^\/uploads\/[a-f0-9-]{36}\.jpg$/);
    expect(url.pathname).not.toContain('nom-client');
    const saved = await fs.readFile(path.join(uploadDir, path.basename(url.pathname)));
    expect(saved).toEqual(jpeg);
    expect((await request(app).get(url.pathname)).status).toBe(200);
    await fs.writeFile(path.join(uploadDir, 'texte.txt'), 'non-image');
    expect((await request(app).get('/uploads/texte.txt')).status).toBe(404);
  });

  test('refuse les fichiers absents, déguisés, inattendus ou trop volumineux', async () => {
    expect((await authorized(request(app).post('/api/upload'))).status).toBe(400);
    expect((await authorized(request(app).post('/api/upload'))
      .attach('image', Buffer.from('<script>test</script>'),
        { filename: 'photo.jpg', contentType: 'image/jpeg' })).status).toBe(415);
    expect((await authorized(request(app).post('/api/upload'))
      .attach('other', jpeg, 'photo.jpg')).status).toBe(400);
    expect((await authorized(request(app).post('/api/upload'))
      .field('extra', 'inutile')
      .attach('image', jpeg, 'photo.jpg')).status).toBe(400);
    expect((await authorized(request(app).post('/api/upload'))
      .attach('image', Buffer.alloc(MAX_IMAGE_BYTES + 1),
        { filename: 'photo.jpg', contentType: 'image/jpeg' })).status).toBe(413);
  });

  test('applique les mêmes contrôles à Mongo et protège la lecture', async () => {
    Photo.create.mockResolvedValue({ _id: '507f1f77bcf86cd799439011' });
    const created = await authorized(request(app).post('/api/photo/upload'))
      .attach('photo', jpeg, { filename: 'photo.jpg', contentType: 'image/jpeg' });
    expect(created.status).toBe(201);
    expect(Photo.create).toHaveBeenCalledWith(expect.objectContaining({
      data: jpeg, contentType: 'image/jpeg', ownerUserId: 1
    }));
    expect(Photo.create.mock.calls[0][0].filename).toMatch(/^[a-f0-9-]{36}\.jpg$/);
    expect((await authorized(request(app).post('/api/photo/upload'))
      .attach('photo', Buffer.from('<svg/>'),
        { filename: 'image.svg', contentType: 'image/svg+xml' })).status).toBe(415);

    const photoId = '507f1f77bcf86cd799439011';
    expect((await request(app).get(`/api/photo/${photoId}`)).status).toBe(401);
    expect((await authorized(request(app).get('/api/photo/invalide'))).status).toBe(400);
    Photo.findOne.mockResolvedValue({ data: jpeg, contentType: 'image/jpeg', ownerUserId: 1 });
    const found = await authorized(request(app).get(`/api/photo/${photoId}`));
    expect(found.status).toBe(200);
    expect(Photo.findOne).toHaveBeenCalledWith({ _id: photoId, ownerUserId: 1 });
    expect(found.headers['x-content-type-options']).toBe('nosniff');
    expect(found.body).toEqual(jpeg);
    const otherToken = jwt.sign({ id: 2, role: 'user' }, process.env.JWT_SECRET);
    expect((await request(app).get(`/api/photo/${photoId}`)
      .set('Authorization', `Bearer ${otherToken}`)).status).toBe(404);
    expect(Photo.findOne).toHaveBeenCalledWith({ _id: photoId, ownerUserId: 2 });
    Photo.findOne.mockResolvedValue({ data: jpeg, contentType: 'image/jpeg' });
    expect((await authorized(request(app).get(`/api/photo/${photoId}`))).status).toBe(404);
    Photo.findOne.mockResolvedValue({ data: Buffer.from('<svg/>'),
      contentType: 'image/jpeg', ownerUserId: 1 });
    expect((await authorized(request(app).get(`/api/photo/${photoId}`))).status).toBe(415);
  });
});
