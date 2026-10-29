// Lanceur obligatoire : nouveau cluster PostgreSQL et services ML temporaires, aucun .env.
process.env.FITS_WARDROBE_V3 = '1';
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
const { isolatedClient } = require('../helpers/isolatedDatabase');
const { sequelize } = require('../../config/db');
require('../../models');
const Vetement = require('../../models/vetement');
const { loadFeatureSchema, extractFeatures } = require('../../services/outfitFeatures');
const { buildTrainingDataset } = require('../../services/trainingDataset');
const { postToMl } = require('../../services/mlClient');
const { REPRESENTATION_VERSION } = require('../../services/mlExperiment');
let db, app, migration;
const auth = req => req.set('Authorization', `Bearer ${jwt.sign({ id: 101, role: 'user' }, process.env.JWT_SECRET)}`);
beforeAll(async () => {
  db = await isolatedClient();
  migration = await fs.readFile(path.join(__dirname, '../../migrations/20261029_wardrobe_v3.sql'), 'utf8');
  await db.query('TRUNCATE utilisateur, categorie, zone RESTART IDENTITY CASCADE');
  await db.query(`INSERT INTO categorie(nom_categorie) VALUES ('Vêtements'),('Chaussures'),('Accessoires');
    INSERT INTO zone(nom_zone,obligatoire,max_elements) VALUES ('torse',true,2),('jambes',true,1),
      ('pieds',true,1),('exterieur',false,1),('tete',false,1);
    INSERT INTO utilisateur(id_utilisateur,nom,prenom,email,password,role) VALUES
      (101,'Fictif','A','a@example.invalid','fictif','user'),(102,'Fictif','B','b@example.invalid','fictif','user');
    INSERT INTO dressing(id_utilisateur) VALUES (101),(102);
    INSERT INTO sous_categorie(nom_sous_categorie,id_categorie,id_zone) VALUES ('Ancien type',1,1);
    INSERT INTO vetement(nom,couleur,temperature_min,temperature_max,id_sous_categorie,id_utilisateur)
      VALUES ('Ancienne pièce','bleu',0,30,1,101);`);
  app = express(); app.use(express.json());
  app.use('/api/categorie', require('../../routes/categorieRoutes'));
  app.use('/api/vetement', require('../../routes/vetementRoutes'));
  app.use(require('../../utils/errorHandler'));
});
afterAll(async () => { await sequelize.close(); if (db) await db.end(); });

test('migration additive, rejouable, sans modification des vêtements existants', async () => {
  await db.query(migration);
  const first = await db.query('SELECT * FROM sous_categorie ORDER BY id_sous_categorie');
  await db.query(migration);
  expect((await db.query('SELECT * FROM sous_categorie ORDER BY id_sous_categorie')).rows).toEqual(first.rows);
  const legacy = (await db.query("SELECT nom,couleur,couleur_secondaire FROM vetement WHERE nom='Ancienne pièce'")).rows[0];
  expect(legacy).toEqual({ nom: 'Ancienne pièce', couleur: 'bleu', couleur_secondaire: null });
  expect(first.rows.some(row => row.nom_sous_categorie === 'Ancien type')).toBe(true);
  expect(first.rows.filter(row => row.nom_sous_categorie === 'Cardigan')).toHaveLength(1);
});

test('vraie base : catalogue, deux couleurs, snapshot, dataset, modèle personnel et fallback', async () => {
  const options = await auth(request(app).get('/api/categorie/options'));
  expect(options.status).toBe(200);
  expect(options.body.max_colors).toBe(2);
  expect(options.body.groups).toHaveLength(6);
  expect(options.body.colors).toHaveLength(18);
  expect((await request(app).get('/api/categorie/options')).status).toBe(401);
  const category = (await db.query("SELECT id_sous_categorie FROM sous_categorie WHERE nom_sous_categorie='Cardigan'")).rows[0];
  const created = await auth(request(app).post('/api/vetement')).send({ nom: 'Cardigan fictif',
    couleur: 'bleu marine', couleur_secondaire: 'écru', temperature_min: -20, temperature_max: 20,
    id_sous_categorie: category.id_sous_categorie });
  expect(created.status).toBe(201);
  const item = await Vetement.findByPk(created.body.id_vetement, { include: { model: require('../../models/sousCategorie'),
    include: require('../../models/zone') } });
  expect(item.couleur_secondaire).toBe('écru');
  const schema = await loadFeatureSchema();
  const { snapshotGarment } = require('../../services/outfitFeatures');
  const snapshot = { version: 3, garments: [{ id_vetement: item.id_vetement, ...snapshotGarment(item, schema) }] };
  // Labels fictifs pour la preuve fonctionnelle, aucune mesure de performance réelle.
  for (let index = 0; index < 20; index++) {
    const { rows: [tenue] } = await db.query('INSERT INTO tenue(id_utilisateur,temperature) VALUES (101,18) RETURNING id_tenue');
    await db.query('INSERT INTO composer VALUES ($1,$2)', [tenue.id_tenue,item.id_vetement]);
    await db.query('INSERT INTO evaluation(id_utilisateur,id_tenue,is_liked,temperature,feature_snapshot) VALUES (101,$1,$2,18,$3)',
      [tenue.id_tenue, index % 2 === 0, JSON.stringify(snapshot)]);
  }
  // Une édition ultérieure ne doit pas changer le dataset figé.
  await item.update({ couleur_secondaire: 'rouge' });
  const dataset = await buildTrainingDataset(101, schema, { includeInteractionMetadata: true });
  expect(dataset).toHaveLength(20);
  expect(dataset[0].couleur_écru).toBe(1);
  expect(dataset[0].couleur_rouge).toBe(0);
  expect(dataset[0].garment_ids_source).toBe('snapshot');
  const data = dataset.map(({ id_tenue, reviewed_at, garment_ids_source, ...row }) => row);
  const payload = { feature_version: schema.version, representation_version: REPRESENTATION_VERSION };
  const expected = extractFeatures(snapshot.garments,18,schema);
  expect(Object.keys(expected).sort()).toEqual(Object.keys(data[0]).filter(key => !['is_liked','garment_ids'].includes(key)).sort());
  const candidates = [{ ...expected, garment_ids: [item.id_vetement] }];
  expect((await postToMl('predict-batch', { ...payload, candidates }, 101)).data.predictions[0].reason).toBe('no_model');
  expect((await postToMl('train', { ...payload, data },101)).data.status).toBe('model trained');
  expect((await postToMl('predict-batch', { ...payload, candidates },101)).data.predictions[0].model_used).toBe('personalized');
  expect((await postToMl('predict-batch', { ...payload, candidates },102)).data.predictions[0].reason).toBe('no_model');
});

test('une migration invalide annule aussi la création de la colonne', async () => {
  // Seulement le cluster éphémère contrôlé par isolatedClient.
  await db.query('ALTER TABLE vetement DROP COLUMN couleur_secondaire');
  await db.query("UPDATE categorie SET nom_categorie='Famille absente' WHERE nom_categorie='Chaussures'");
  try { await expect(db.query(migration)).rejects.toThrow('Famille absente ou ambiguë'); }
  finally { await db.query('ROLLBACK'); }
  const columns = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='vetement' AND column_name='couleur_secondaire'");
  expect(columns.rows).toHaveLength(0);
});
