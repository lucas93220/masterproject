// PostgreSQL, Express, HTTP FastAPI et fichiers réels dans le cluster temporaire.
// MongoDB réel aussi, via l'URI éphémère contrôlée par le lanceur ; pas de .env.
jest.mock('../../config/db', () => {
  const { Sequelize } = require('sequelize');
  const config = require('../helpers/isolatedDatabase').isolatedConfig();
  return { sequelize: new Sequelize(config.database, config.user, '', {
    host: config.host, port: config.port, dialect: 'postgres', logging: false
  }) };
});

const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { execFileSync } = require('node:child_process');
const http = require('node:http');
const { isolatedClient } = require('../helpers/isolatedDatabase');
const { sequelize } = require('../../config/db');
require('../../models');
const Vetement = require('../../models/vetement');
const Photo = require('../../models/photo');
const Log = require('../../models/log');
const { buildTrainingDataset } = require('../../services/trainingDataset');
const { loadFeatureSchema, extractFeatures } = require('../../services/outfitFeatures');
const { postToMl } = require('../../services/mlClient');
const { retryCleanup, jobPath } = require('../../services/accountDeletion');
const root = process.env.FITS_ISOLATED_ROOT;
let db, server;
const token = id => `Bearer ${jwt.sign({ id, role: 'user' }, process.env.JWT_SECRET)}`;
const authenticated = (req, id = 1) => req.set('Authorization', token(id));
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

beforeAll(async () => {
  db = await isolatedClient(); // contrôle du serveur AVANT la première écriture
  const uri = process.env.FITS_TEST_MONGO_URL;
  if (!/^mongodb:\/\/127\.0\.0\.1:\d+\/fits_isolated$/.test(uri || '')) {
    throw new Error('MongoDB temporaire requis');
  }
  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 3000 });
  const options = await mongoose.connection.db.admin().command({ getCmdLineOpts: 1 });
  if (options.parsed.storage.dbPath !== path.join(root, 'mongo')) throw new Error('Refus de MongoDB non isolé');
  const app = express();
  app.use(express.json());
  for (const [prefix, routes] of [
    ['/api/tenue', 'tenueRoutes'], ['/api/evaluation', 'evaluationRoutes'],
    ['/api/ml', 'mlRoutes'], ['/api/upload', 'uploadRoutes'], ['/api/photo', 'photoRoutes'],
    ['/api/utilisateur', 'utilisateurRoutes'], ['/api/vetement', 'vetementRoutes'],
    ['/uploads', 'privateImageRoutes']
  ]) app.use(prefix, require(`../../routes/${routes}`));
  app.use(require('../../utils/errorHandler'));
  server = await new Promise(resolve => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  process.env.PORT = String(server.address().port);
});

afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await sequelize.close();
  await mongoose.disconnect();
  if (db) await db.end();
});

beforeEach(async () => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  await db.query('TRUNCATE utilisateur, categorie, zone RESTART IDENTITY CASCADE');
  for (const name of ['uploads', 'models', 'interactions', 'jobs']) {
    await fs.rm(path.join(root, name), { recursive: true, force: true });
    await fs.mkdir(path.join(root, name), { mode: 0o700 });
  }
  await db.query(`INSERT INTO utilisateur (nom,prenom,email,password,role)
    VALUES ('Fictif','A','a@example.invalid','aucun-mot-de-passe-reel','user'),
      ('Fictif','B','b@example.invalid','aucun-mot-de-passe-reel','user');
    INSERT INTO dressing (id_utilisateur) VALUES (1),(2);
    INSERT INTO categorie (nom_categorie) VALUES ('Hauts'),('Bas'),('Chaussures');
    INSERT INTO zone (nom_zone,obligatoire) VALUES ('torse',true),('jambes',true),('pieds',true),
      ('tete',false),('cou',false),('mains',false),('exterieur',false),('taille',false),('accessoires',false);
    INSERT INTO sous_categorie (nom_sous_categorie,id_categorie,id_zone)
      VALUES ('T-shirt',1,1),('Pantalon',2,2),('Baskets',3,3);
    INSERT INTO vetement (nom,couleur,temperature_min,temperature_max,id_sous_categorie)
      SELECT 'Vêtement fictif ' || n, CASE WHEN n % 3 = 1 THEN 'bleu' ELSE 'noir' END,
        0,30,((n-1)%3)+1 FROM generate_series(1,6) n;
    INSERT INTO contenir SELECT CASE WHEN n<=3 THEN 1 ELSE 2 END,n FROM generate_series(1,6) n;`);
  await Photo.deleteMany({});
  await Log.deleteMany({});
  await Photo.insertMany([{ ownerUserId: 1, data: jpeg }, { ownerUserId: 2, data: jpeg }]);
  await Log.insertMany([{ userId: '1', action: 'fixture' }, { userId: '2', action: 'fixture' }]);
});

test('parcours réel SQL/HTTP : génération, avis, 85 features figées, entraînement personnel et fallback', async () => {
  const generated = await authenticated(request(server).get('/api/tenue/generate?temperature=18'));
  expect(generated.status).toBe(200);
  expect(generated.body.vetements).toHaveLength(3);
  expect(generated.body.recommendation).toEqual({ model_used: 'fallback', reason: 'no_model' });
  const outfit = generated.body.id_tenue;
  const trace = await Log.findOne({ userId: '1', action: 'outfit_prediction',
    'details.id_tenue': outfit }).lean();
  expect(trace.details.model_used).toBe('fallback');
  expect(typeof trace.details.probability_like).toBe('number');
  expect((await db.query('SELECT id_tenue FROM evaluation WHERE id_tenue=$1', [outfit])).rowCount)
    .toBe(0); // La prédiction existe avant le premier vote.
  const schema = await loadFeatureSchema();
  const candidate = extractFeatures(generated.body.vetements, 18, schema);
  expect(Object.keys(candidate)).toHaveLength(85);

  expect((await authenticated(request(server).post('/api/evaluation'), 2)
    .send({ id_tenue: outfit, is_liked: true })).status).toBe(403);
  expect((await authenticated(request(server).post('/api/evaluation'))
    .send({ id_tenue: outfit, is_liked: 'false' })).status).toBe(400);
  expect((await authenticated(request(server).post('/api/evaluation'))
    .send({ id_tenue: outfit, is_liked: false })).status).toBe(201);

  const voteTime = await db.query(`SELECT date_avis AT TIME ZONE 'UTC' AS voted_at
    FROM evaluation WHERE id_tenue=$1`, [outfit]);
  expect(voteTime.rows[0].voted_at.getTime()).toBeGreaterThan(trace.date.getTime());

  const stored = await db.query('SELECT feature_snapshot FROM evaluation WHERE id_tenue=$1',
    [outfit]);
  expect(stored.rows[0].feature_snapshot.version).toBe(2);
  expect(stored.rows[0].feature_snapshot.garments.map(item => item.id_vetement).sort())
    .toEqual(generated.body.vetements.map(item => item.id_vetement).sort());
  const interactionRows = await buildTrainingDataset(1, schema,
    { includeInteractionMetadata: true });
  expect(interactionRows[0].garment_ids_source).toBe('snapshot');
  expect(interactionRows[0].garment_ids).toEqual(
    generated.body.vetements.map(item => item.id_vetement).sort());

  const before = await buildTrainingDataset(1, schema);
  expect(before).toEqual([{ ...candidate, is_liked: 0 }]);
  await db.query("UPDATE vetement SET couleur='rouge',favori=true WHERE id_vetement=1");
  expect(await buildTrainingDataset(1, schema)).toEqual(before); // snapshot SQL effectif
  await db.query("UPDATE vetement SET couleur='bleu',favori=false WHERE id_vetement=1");

  // Avis inventés avec préférence thermique opposée : preuve d'isolation, PAS performance réelle.
  for (const user of [1, 2]) {
    const start = user === 1 ? 1 : 0;
    for (let i = start; i < 20; i++) {
      const temp = i < 10 ? 18 : 25;
      const created = await db.query('INSERT INTO tenue(id_utilisateur,temperature) VALUES ($1,$2) RETURNING id_tenue', [user,temp]);
      const id = created.rows[0].id_tenue;
      await db.query('INSERT INTO composer SELECT $1,id_vetement FROM contenir WHERE id_dressing=$2', [id,user]);
      const review = await authenticated(request(server).post('/api/evaluation'), user)
        .send({ id_tenue: id, is_liked: user === 1 ? i >= 10 : i < 10 });
      expect(review.status).toBe(201);
    }
  }
  expect(await buildTrainingDataset(1, schema)).toHaveLength(20);
  expect(await buildTrainingDataset(2, schema)).toHaveLength(20);
  const prediction = { ...candidate, feature_version: schema.version,
    representation_version: 'items-pairs-v1',
    garment_ids: generated.body.vetements.map(item => item.id_vetement).sort((a, b) => a - b) };
  const response1 = await postToMl('predict', prediction, 1);
  const response2 = await postToMl('predict', prediction, 2);
  expect(response1.data.model_used).toBe('personalized');
  expect(response2.data.model_used).toBe('personalized');
  expect(response2.data.probability_like).toBeGreaterThan(response1.data.probability_like);
  const artifacts = await fs.readdir(path.join(root, 'interactions'));
  expect(artifacts).toContain('user_1.joblib');
  expect(artifacts).toContain('user_2.joblib');
  expect(await fs.readdir(path.join(root, 'models'))).toEqual([]);
  const generatedAgain = await authenticated(request(server).get('/api/tenue/generate?temperature=18'));
  expect(generatedAgain.body.recommendation.model_used).toBe('personalized');
});

test('retrait : plus de suggestion, avis historique conservé et compte effacé sans vêtement orphelin', async () => {
  const created = await db.query(`INSERT INTO vetement
    (nom,couleur,temperature_min,temperature_max,id_sous_categorie,id_utilisateur)
    VALUES ('Manteau historique','noir',0,30,1,1),
      ('Pièce jamais proposée','noir',0,30,1,1) RETURNING id_vetement`);
  const [historicId, unusedId] = created.rows.map(row => row.id_vetement);
  await db.query('INSERT INTO contenir VALUES (1,$1),(1,$2)', [historicId, unusedId]);
  const outfit = await db.query('INSERT INTO tenue(id_utilisateur,temperature) VALUES (1,18) RETURNING id_tenue');
  await db.query('INSERT INTO composer VALUES ($1,$2)', [outfit.rows[0].id_tenue, historicId]);
  expect((await authenticated(request(server).post('/api/evaluation'))
    .send({ id_tenue: outfit.rows[0].id_tenue, is_liked: false })).status).toBe(201);
  const schema = await loadFeatureSchema();
  const history = await buildTrainingDataset(1, schema);
  expect(history).toHaveLength(1);

  for (const id of [historicId, unusedId]) {
    const removed = await authenticated(request(server).delete(`/api/vetement/${id}`));
    expect(removed.status).toBe(200);
    expect((await authenticated(request(server).get(`/api/vetement/${id}`))).status).toBe(404);
  }
  expect((await db.query('SELECT id_vetement FROM composer WHERE id_vetement=$1', [historicId])).rowCount).toBe(1);
  expect(await buildTrainingDataset(1, schema)).toEqual(history);
  expect((await db.query('SELECT id_utilisateur FROM vetement WHERE id_vetement=$1', [unusedId])).rows[0].id_utilisateur).toBe(1);
  const generated = await authenticated(request(server).get('/api/tenue/generate?temperature=18'));
  expect(generated.status).toBe(200);
  expect(generated.body.vetements.map(item => item.id_vetement)).not.toContain(historicId);
  expect(generated.body.vetements.map(item => item.id_vetement)).not.toContain(unusedId);

  expect((await authenticated(request(server).delete('/api/utilisateur/me'))).status).toBe(200);
  expect((await db.query('SELECT id_vetement FROM vetement WHERE id_vetement=ANY($1)',
    [[historicId, unusedId]])).rowCount).toBe(0);
  expect((await db.query('SELECT id_vetement FROM vetement WHERE id_vetement=4')).rowCount).toBe(1);
});

test('migration fictive : attribue seulement les vêtements avec un propriétaire certain', async () => {
  await db.query('BEGIN');
  try {
    await db.query('ALTER TABLE vetement DROP COLUMN id_utilisateur');
    const historical = await db.query('INSERT INTO tenue(id_utilisateur,temperature) VALUES (1,18) RETURNING id_tenue');
    await db.query('INSERT INTO composer VALUES ($1,1)', [historical.rows[0].id_tenue]);
    await db.query('DELETE FROM contenir WHERE id_vetement IN (1,2)');
    const ambiguous = await db.query('INSERT INTO tenue(id_utilisateur,temperature) VALUES (2,18) RETURNING id_tenue');
    await db.query('INSERT INTO composer VALUES ($1,3)', [ambiguous.rows[0].id_tenue]);
    const migration = await fs.readFile(path.join(__dirname,
      '../../migrations/20261022_add_vetement_owner.sql'), 'utf8');
    // L'enveloppe transactionnelle du fichier est remplacée par celle de la fixture.
    await db.query(migration.replace(/^BEGIN;\s*$/m, '').replace(/^COMMIT;\s*$/m, ''));
    const rows = (await db.query('SELECT id_vetement,id_utilisateur FROM vetement ORDER BY id_vetement')).rows;
    expect(rows.slice(0, 4)).toEqual([
      { id_vetement: 1, id_utilisateur: 1 }, // composition passée uniquement
      { id_vetement: 2, id_utilisateur: null }, // aucun lien
      { id_vetement: 3, id_utilisateur: null }, // liens contradictoires
      { id_vetement: 4, id_utilisateur: 2 }
    ]);
  } finally {
    await db.query('ROLLBACK');
  }
});

test('suppression avec vraies cascades SQL, images privées, Joblib, reprise Mongo et sessions révoquées', async () => {
  const upload = await authenticated(request(server).post('/api/upload')).attach('image', jpeg, 'test.jpg');
  expect(upload.status).toBe(200);
  const url = new URL(upload.body.imageUrl);
  await db.query('UPDATE vetement SET photo=$1 WHERE id_vetement=1', [upload.body.imageUrl]);
  expect((await request(server).get(url.pathname)).status).toBe(401);
  expect((await authenticated(request(server).get(url.pathname), 2)).status).toBe(404);
  expect((await authenticated(request(server).get(url.pathname))).status).toBe(200);

  const legacy = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg';
  await fs.writeFile(path.join(root, 'uploads', legacy), jpeg);
  await db.query('UPDATE vetement SET photo=$1 WHERE id_vetement=2', [`http://192.168.2.1:3002/uploads/${legacy}`]);
  expect((await authenticated(request(server).get(`/uploads/${legacy}`))).status).toBe(200);
  expect((await authenticated(request(server).get(`/uploads/${legacy}`), 2)).status).toBe(404);
  const timestampLegacy = '1760961600000-abcde.jpg';
  await fs.writeFile(path.join(root, 'uploads', timestampLegacy), jpeg);
  await db.query('UPDATE vetement SET photo=$1 WHERE id_vetement=3',
    [`http://192.168.1.181:3002/uploads/${timestampLegacy}`]);
  expect((await request(server).get(`/uploads/${timestampLegacy}`)).status).toBe(401);
  expect((await authenticated(request(server).get(`/uploads/${timestampLegacy}`))).status).toBe(200);
  expect((await authenticated(request(server).get(`/uploads/${timestampLegacy}`), 2)).status).toBe(404);
  // Une relation historique partagée doit rester intacte chez le second compte.
  await db.query('INSERT INTO contenir VALUES (1,4)');
  const generated = await authenticated(request(server).get('/api/tenue/generate?temperature=18'));
  expect((await authenticated(request(server).post('/api/evaluation'))
    .send({ id_tenue: generated.body.id_tenue, is_liked: false })).status).toBe(201);
  await fs.writeFile(path.join(root, 'models', 'user_1.joblib'), 'artefact-fictif-a-effacer');
  await fs.writeFile(path.join(root, 'models', 'user_2.joblib'), 'autre-artefact');
  jest.spyOn(Photo, 'deleteMany').mockRejectedValueOnce(new Error('panne Mongo injectée'));
  const deleted = await authenticated(request(server).delete('/api/utilisateur/me'));
  expect(deleted.status).toBe(202);
  for (const table of ['utilisateur', 'dressing', 'tenue', 'evaluation']) {
    expect((await db.query(`SELECT count(*)::int AS n FROM ${table} WHERE id_utilisateur=1`)).rows[0].n).toBe(0);
  }
  expect((await db.query('SELECT id_vetement FROM vetement ORDER BY id_vetement')).rows)
    .toEqual([4,5,6].map(id_vetement => ({ id_vetement })));
  expect((await db.query('SELECT id_vetement FROM contenir WHERE id_dressing=2 ORDER BY id_vetement')).rows).toHaveLength(3);
  expect(await fs.readdir(path.join(root, 'uploads'))).toEqual([]);
  expect(await fs.readFile(path.join(root, 'models/user_2.joblib'), 'utf8')).toBe('autre-artefact');
  expect((await authenticated(request(server).post('/api/upload')).attach('image', jpeg, 'test.jpg')).status).toBe(401);
  expect(await retryCleanup(1)).toEqual({ complete: true, pending: [] });
  expect((await Photo.find({}, { _id: 0, ownerUserId: 1 }).lean())).toEqual([{ ownerUserId: 2 }]);
  expect((await Log.find({}, { _id: 0, userId: 1 }).lean())).toEqual([{ userId: '2' }]);
  await expect(fs.access(jobPath(1))).rejects.toMatchObject({ code: 'ENOENT' });
  const receipt = JSON.parse(await fs.readFile(path.join(root, 'jobs/receipts/user_1.json'), 'utf8'));
  expect(receipt.userId).toBe(1);
  expect(receipt.version).toBe(2);
  expect(receipt.files).toBeUndefined();
});

test('échec après suppression SQL : rollback effectif du compte et de ses relations', async () => {
  const generated = await authenticated(request(server).get('/api/tenue/generate?temperature=18'));
  expect(generated.status).toBe(200);
  jest.spyOn(Vetement, 'destroy').mockRejectedValueOnce(new Error('incident injecté'));
  const deletePhotos = jest.spyOn(Photo, 'deleteMany');
  const response = await authenticated(request(server).delete('/api/utilisateur/me'));
  expect(response.status).toBe(500);
  expect((await db.query('SELECT count(*)::int AS n FROM utilisateur WHERE id_utilisateur=1')).rows[0].n).toBe(1);
  expect((await db.query('SELECT count(*)::int AS n FROM contenir WHERE id_dressing=1')).rows[0].n).toBe(3);
  expect((await db.query('SELECT count(*)::int AS n FROM composer')).rows[0].n).toBe(3);
  expect(deletePhotos).not.toHaveBeenCalled();
  await expect(fs.access(jobPath(1))).rejects.toMatchObject({ code: 'ENOENT' });
});

test('un manifeste laissé avant validation SQL ne bloque pas la suppression suivante', async () => {
  await fs.writeFile(jobPath(1), JSON.stringify({ version: 1, userId: 1,
    files: ['u1_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg'] }));
  const response = await authenticated(request(server).delete('/api/utilisateur/me'));
  expect(response.status).toBe(200);
  expect((await db.query('SELECT id_utilisateur FROM utilisateur WHERE id_utilisateur=1')).rowCount).toBe(0);
  await expect(fs.access(jobPath(1))).rejects.toMatchObject({ code: 'ENOENT' });
});

test('rétention Mongo réelle : aperçu sans écriture puis suppression limitée aux dates expirées', async () => {
  const { retainLogs } = require('../../services/logRetention');
  const now = new Date('2026-10-13T12:00:00Z');
  await Log.deleteMany({});
  await Log.collection.insertMany([
    { action: 'ancien', date: new Date('2026-09-12T12:00:00Z') },
    { action: 'limite', date: new Date('2026-09-13T12:00:00Z') },
    { action: 'recent', date: now }, { action: 'sans_date' }
  ]);
  const report = await retainLogs(Log, { now });
  expect(report).toMatchObject({ eligible: 1, undated: 1, deleted: 0, mode: 'dry_run' });
  expect(await Log.countDocuments({})).toBe(4);
  expect((await retainLogs(Log, { now, apply: true })).deleted).toBe(1);
  expect((await Log.find().sort({ action: 1 }).lean()).map(row => row.action))
    .toEqual(['limite', 'recent', 'sans_date']);
});

test('sauvegarde/restauration PostgreSQL fictive : un compte effacé réapparu reste bloqué', async () => {
  const { readErasureReceipts, checkRestoredAccounts } = require('../../services/erasureReceipts');
  const backup = path.join(root, 'fixture.dump');
  const connection = ['--host', root, '--port', '55439', '--username', 'fits_test', '--dbname', 'fits_isolated'];
  execFileSync('pg_dump', [...connection, '--format=custom', '--file', backup], { timeout: 10000 });
  expect((await authenticated(request(server).delete('/api/utilisateur/me'))).status).toBe(200);
  const receipts = await readErasureReceipts();
  expect((await checkRestoredAccounts(db, receipts)).status).toBe('sql_clear');
  execFileSync('pg_restore', [...connection, '--clean', '--if-exists', backup], { timeout: 10000 });
  expect((await checkRestoredAccounts(db, receipts)).status).toBe('blocked');
  expect((await authenticated(request(server).get('/api/utilisateur/me'))).status).toBe(401);
  expect((await authenticated(request(server).get('/api/utilisateur/me'), 2)).status).toBe(200);
});

test('service ML qui ne répond plus : génération bornée et fallback explicite via HTTP réel', async () => {
  const hanging = http.createServer(() => {});
  await new Promise(resolve => hanging.listen(0, '127.0.0.1', resolve));
  const originalUrl = process.env.ML_EXPERIMENTAL_URL;
  const originalTimeout = process.env.ML_PREDICT_TIMEOUT_MS;
  process.env.ML_EXPERIMENTAL_URL = `http://127.0.0.1:${hanging.address().port}`;
  process.env.ML_PREDICT_TIMEOUT_MS = '40';
  try {
    const result = await authenticated(request(server).get('/api/tenue/generate?temperature=18')).timeout(3000);
    expect(result.status).toBe(200);
    expect(result.body.vetements).toHaveLength(3);
    expect(result.body.recommendation).toEqual({ model_used: 'fallback', reason: 'ml_unavailable' });
  } finally {
    process.env.ML_EXPERIMENTAL_URL = originalUrl;
    if (originalTimeout === undefined) delete process.env.ML_PREDICT_TIMEOUT_MS;
    else process.env.ML_PREDICT_TIMEOUT_MS = originalTimeout;
    hanging.closeAllConnections();
    await new Promise(resolve => hanging.close(resolve));
  }
});


test.each([['/api/upload', 'image'], ['/api/photo/upload', 'photo']])(
  'un upload commencé avant suppression mais terminé après ne recrée rien (%s)', async (endpoint, field) => {
    const User = require('../../models/utilisateur');
    const original = User.findByPk.bind(User);
    let authenticatedUpload;
    const authenticatedPromise = new Promise(resolve => { authenticatedUpload = resolve; });
    jest.spyOn(User, 'findByPk').mockImplementation(async (...args) => {
      const user = await original(...args);
      if (!args[1]?.transaction) authenticatedUpload();
      return user;
    });
    const boundary = 'fits-isolated-delayed-upload';
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const head = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="test.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`), jpeg]);
    let upload;
    const response = new Promise((resolve, reject) => {
      upload = http.request({ host: '127.0.0.1', port: server.address().port, method: 'POST', path: endpoint,
        headers: { Authorization: token(1), 'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': head.length + tail.length } }, res => {
        res.resume(); res.on('end', () => resolve(res.statusCode));
      });
      upload.on('error', reject); upload.write(head);
    });
    try {
      await authenticatedPromise;
      const deletion = await authenticated(request(server).delete('/api/utilisateur/me'));
      expect(deletion.status).toBe(200);
    } finally { upload.end(tail); }
    expect(await response).toBe(401);
    expect(await fs.readdir(path.join(root, 'uploads'))).toEqual([]);
    expect(await Photo.countDocuments({ ownerUserId: 1 })).toBe(0);
  }
);

test('la suppression attend une écriture déjà verrouillée puis efface son fichier', async () => {
  const { withAccountWrite } = require('../../services/accountWrite');
  const { deleteAccount } = require('../../services/accountDeletion');
  let entered, release;
  const started = new Promise(resolve => { entered = resolve; });
  const released = new Promise(resolve => { release = resolve; });
  const file = path.join(root, 'uploads', 'u1_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg');
  const writing = withAccountWrite(1, async () => { entered(); await released; await fs.writeFile(file, jpeg); });
  await started;
  const deleting = deleteAccount(1);
  release(); await writing; await deleting;
  expect(await fs.readdir(path.join(root, 'uploads'))).toEqual([]);
  expect((await db.query('SELECT id_utilisateur FROM utilisateur WHERE id_utilisateur=1')).rows).toEqual([]);
});
