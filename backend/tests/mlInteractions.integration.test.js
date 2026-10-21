jest.mock('../models/evaluation', () => ({ findAll: jest.fn() }));
jest.mock('../models/tenue', () => ({ findAll: jest.fn() }));
jest.mock('../models/composer', () => ({ findAll: jest.fn(async () => []) }));
jest.mock('../models/vetement', () => ({ findAll: jest.fn() }));
jest.mock('../models/sousCategorie', () => ({ findAll: jest.fn(async () => [
  { id_sous_categorie: 1, id_categorie: 1, nom_sous_categorie: 'T-shirt' }
]) }));
jest.mock('../models/categorie', () => ({ findAll: jest.fn(async () => [
  { id_categorie: 1, nom_categorie: 'Vêtements' }
]) }));
jest.mock('../models/zone', () => ({ findAll: jest.fn(async () =>
  ['torse', 'jambes', 'pieds', 'tete', 'yeux', 'cou', 'mains', 'exterieur', 'autres']
    .map((nom_zone, index) => ({ nom_zone, id_zone: index + 1 }))) }));
jest.mock('../services/mlClient', () => ({ postToMl: jest.fn() }));
jest.mock('../config/db', () => { throw new Error('Aucune base réelle autorisée'); });

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const Evaluation = require('../models/evaluation');
const Tenue = require('../models/tenue');
const Vetement = require('../models/vetement');
const { postToMl } = require('../services/mlClient');
const { loadFeatureSchema } = require('../services/outfitFeatures');
const { trainModel } = require('../controllers/mlController');
const { rankCandidates } = require('../services/rankCandidates');

const integration = process.env.ML_TEST_PYTHON ? test : test.skip;
integration('snapshots Node → 85 features + identités → vrai Python → classement personnalisé', async () => {
  const previous = [process.env.ML_EXPERIMENTAL_URL, process.env.ML_EXPERIMENTAL_USER_ID];
  process.env.ML_EXPERIMENTAL_URL = 'http://127.0.0.1:8001';
  const outfits = [];
  const evaluations = [];
  const candidates = [];
  // Same general features and balanced item marginals; only pair identity changes the label.
  for (let index = 0; index < 80; index++) {
    const jeans = index % 4 < 2 ? 1 : 2;
    const coat = index % 2 ? 4 : 3;
    const garments = [jeans, coat, 5, 6].map(id_vetement => ({ id_vetement,
      couleur: 'noir', favori: false, zone_name: 'torse',
      category_name: 'vetements', subcategory_name: 't-shirt' }));
    if (index < 4) candidates.push(garments);
    for (const user of [1, 2]) {
      const id = user * 1000 + index;
      outfits.push({ id_tenue: id, id_utilisateur: user, temperature: 18 });
      evaluations.push({ id_tenue: id, id_utilisateur: user, temperature: 18,
        is_liked: ((jeans === 1) !== (coat === 3)) !== (user === 2),
        date_avis: new Date('2026-01-01T00:00:00Z'),
        feature_snapshot: { version: 2, garments } });
    }
  }
  Evaluation.findAll.mockImplementation(async ({ where }) =>
    evaluations.filter(row => row.id_utilisateur === where.id_utilisateur));
  Tenue.findAll.mockImplementation(async ({ where }) =>
    outfits.filter(row => row.id_utilisateur === where.id_utilisateur));
  postToMl.mockResolvedValue({ data: { status: 'model trained' } });
  const next = jest.fn();
  try {
    for (const user of [1, 2]) {
      process.env.ML_EXPERIMENTAL_USER_ID = String(user);
      await trainModel({ user: { id: user } }, { json: jest.fn() }, next);
    }
    expect(next).not.toHaveBeenCalled();
    const trains = postToMl.mock.calls.filter(call => call[0] === 'train').map(call => call[1]);
    expect(trains).toHaveLength(2);
    expect(trains[0].data).toHaveLength(80);
    expect(Object.keys(trains[0].data[0])).toHaveLength(87); // 85 context + label + ids
    expect(Vetement.findAll).not.toHaveBeenCalled(); // immutable snapshots, not current wardrobe
    process.env.ML_EXPERIMENTAL_USER_ID = '1';
    const schema = await loadFeatureSchema();
    postToMl.mockResolvedValue({ data: { predictions: candidates.map(() => ({
      probability_like: 0.5, model_used: 'fallback', reason: 'no_model'
    })) } });
    await rankCandidates(candidates, 18, schema, 1);
    const batch = postToMl.mock.calls.find(call => call[0] === 'predict-batch')[1];
    const { is_liked, ...firstTraining } = trains[0].data[0];
    expect(batch.candidates[0]).toEqual(firstTraining);
    const bridge = spawnSync(process.env.ML_TEST_PYTHON,
      [path.resolve(__dirname, '../../ml-service/demo_interactions.py'), '--test-bridge'], {
        input: JSON.stringify({ train_one: trains[0], train_two: trains[1], batch }),
        encoding: 'utf8', timeout: 60000,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }
      });
    if (bridge.error) throw bridge.error;
    if (bridge.status !== 0) throw new Error(bridge.stderr);
    const results = JSON.parse(bridge.stdout);
    expect(results.reference_unchanged).toBe(true);
    expect(results.predict_one.predictions[0].probability_like)
      .toBeLessThan(results.predict_one.predictions[1].probability_like);
    expect(results.predict_two.predictions[0].probability_like)
      .toBeGreaterThan(results.predict_two.predictions[1].probability_like);
    postToMl.mockResolvedValue({ data: results.predict_one });
    const selected = await rankCandidates(candidates, 18, schema, 1);
    expect([candidates[1], candidates[2]]).toContain(selected.candidate);
    expect(selected.prediction.model_used).toBe('personalized');
    expect(results.no_model.predictions.every(row => row.reason === 'no_model')).toBe(true);
  } finally {
    ['ML_EXPERIMENTAL_URL', 'ML_EXPERIMENTAL_USER_ID'].forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
  }
}, 70000);
