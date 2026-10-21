jest.mock('axios', () => ({ post: jest.fn() }));
jest.mock('../services/trainingDataset', () => ({ buildTrainingDataset: jest.fn() }));
jest.mock('../services/outfitFeatures', () => ({
  loadFeatureSchema: jest.fn(),
  extractFeatures: jest.fn(() => ({ temperature: 18, nb_vetements: 2,
    nb_favoris: 1, ratio_favoris: 0.5 }))
}));
jest.mock('../config/db', () => { throw new Error('Aucune base réelle autorisée'); });

const axios = require('axios');
const { experimentalUrl } = require('../services/mlExperiment');
const { postToMl } = require('../services/mlClient');
const { buildTrainingDataset } = require('../services/trainingDataset');
const { loadFeatureSchema } = require('../services/outfitFeatures');
const { trainModel } = require('../controllers/mlController');
const { rankCandidates } = require('../services/rankCandidates');
const keys = ['ML_EXPERIMENTAL_URL', 'ML_EXPERIMENTAL_USER_ID',
  'ML_SERVICE_URL', 'ML_SERVICE_SECRET', 'NODE_ENV'];
const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const schema = { version: 'outfit-v2-test', zoneNames: [], categoryVocabulary: [], subcategoryVocabulary: [] };
const candidates = [[{ id_vetement: 4 }, { id_vetement: 1 }],
  [{ id_vetement: 1 }, { id_vetement: 5 }]];

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of keys) delete process.env[key];
  process.env.ML_SERVICE_SECRET = 'fake-test-secret';
  process.env.ML_EXPERIMENTAL_URL = 'http://127.0.0.1:8001';
  loadFeatureSchema.mockResolvedValue(schema);
});
afterAll(() => {
  for (const key of keys) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
});

test('articles/paires est le modèle normal de chaque compte authentifié', async () => {
  axios.post.mockResolvedValue({ data: {} });
  expect(experimentalUrl()).toBe('http://127.0.0.1:8001');
  await postToMl('train', { user_id: 8 }, 7);
  await postToMl('train', { user_id: 7 }, 8);
  expect(axios.post.mock.calls[0][0]).toBe('http://127.0.0.1:8001/train');
  expect(axios.post.mock.calls[0][2].headers['X-FITS-USER-ID']).toBe('7');
  expect(axios.post.mock.calls[1][0]).toBe('http://127.0.0.1:8001/train');
  expect(axios.post.mock.calls[1][2].headers['X-FITS-USER-ID']).toBe('8');
  delete process.env.ML_EXPERIMENTAL_URL;
  await postToMl('train', {}, 7);
  expect(axios.post.mock.calls[2][0]).toBe('http://127.0.0.1:8001/train');
});

test.each(['http://127.0.0.1:8000', 'http://remote.test:8001',
  'http://secret@127.0.0.1:8001', 'http://127.0.0.1:8001/train',
  'http://127.0.0.1:8001/?x=1', 'https://127.0.0.1:8001'])('refuse une cible dangereuse %s', url => {
  process.env.ML_EXPERIMENTAL_URL = url;
  expect(experimentalUrl).toThrow();
});

test('le service normal reste disponible en production et sans option de compte', () => {
  process.env.NODE_ENV = 'production';
  expect(experimentalUrl()).toBe('http://127.0.0.1:8001');
  delete process.env.NODE_ENV;
  process.env.ML_EXPERIMENTAL_USER_ID = '07';
  expect(experimentalUrl()).toBe('http://127.0.0.1:8001');
  delete process.env.ML_EXPERIMENTAL_URL;
  expect(experimentalUrl()).toBe('http://127.0.0.1:8001');
  expect(axios.post).not.toHaveBeenCalled();
});

test('l’entraînement courant garde uniquement les identités figées du compte', async () => {
  buildTrainingDataset.mockResolvedValue([
    { temperature: 18, is_liked: 1, garment_ids: [1, 4], garment_ids_source: 'snapshot',
      id_tenue: 100, reviewed_at: '2026-01-01T00:00:00Z' },
    { temperature: 18, is_liked: 0, garment_ids: [1, 5], garment_ids_source: 'composer_current',
      id_tenue: 101, reviewed_at: '2026-01-01T00:00:00Z' }
  ]);
  axios.post.mockResolvedValue({ data: { status: 'model trained' } });
  const next = jest.fn();
  const res = { json: jest.fn() };
  await trainModel({ user: { id: 7 } }, res, next);
  expect(next).not.toHaveBeenCalled();
  expect(buildTrainingDataset).toHaveBeenCalledWith(7, schema, { includeInteractionMetadata: true });
  expect(axios.post.mock.calls[0][1]).toMatchObject({
    representation_version: 'items-pairs-v1', feature_version: schema.version,
    data: [{ temperature: 18, is_liked: 1, garment_ids: [1, 4] }]
  });
  expect(res.json).toHaveBeenCalledWith({ message: 'Model trained successfully' });
});

test('la génération fournit les identités serveur dans un seul lot et retient le meilleur score', async () => {
  axios.post.mockResolvedValue({ data: { predictions: [
    { probability_like: 0.2, model_used: 'personalized', model_variant: 'items-pairs-v1', model_revision: 'one' },
    { probability_like: 0.8, model_used: 'personalized', model_variant: 'items-pairs-v1', model_revision: 'one' }
  ] } });
  const result = await rankCandidates(candidates, 18, schema, 7);
  expect(result.candidate).toBe(candidates[1]);
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.post.mock.calls[0][0]).toBe('http://127.0.0.1:8001/predict-batch');
  expect(axios.post.mock.calls[0][1].candidates.map(row => row.garment_ids)).toEqual([[1, 4], [1, 5]]);
});

test.each([
  [], [{ probability_like: 0.9, model_used: 'personalized' }],
  [{ probability_like: NaN }, { probability_like: 0.5 }],
  [{ probability_like: 0.9, model_used: 'personalized', model_variant: 'items-pairs-v1', model_revision: 'old' },
    { probability_like: 0.7, model_used: 'personalized', model_variant: 'items-pairs-v1', model_revision: 'new' }]
])('lot invalide : fallback complet, sans appel au modèle de référence', async (...predictions) => {
  axios.post.mockResolvedValue({ data: { predictions } });
  const result = await rankCandidates(candidates, 18, schema, 7);
  expect(result.prediction.model_used).toBe('fallback');
  expect(axios.post).toHaveBeenCalledTimes(1);
});

test('une panne expérimentale ne provoque pas un entraînement ou une prédiction de référence', async () => {
  axios.post.mockRejectedValue(new Error('offline'));
  expect((await rankCandidates(candidates, 18, schema, 7)).prediction.reason).toBe('ml_unavailable');
  expect(axios.post).toHaveBeenCalledTimes(1);
});

test('un candidat sans identité fiable ne part pas au ML', async () => {
  const result = await rankCandidates([[{ id_vetement: 1 }, { id_vetement: 1 }]], 18, schema, 7);
  expect(result.prediction.model_used).toBe('fallback');
  expect(axios.post).not.toHaveBeenCalled();
});

test('suppression des deux modèles, y compris RF historique ; échec signalé pour la reprise', async () => {
  delete process.env.ML_EXPERIMENTAL_USER_ID;
  axios.post.mockResolvedValue({ data: { status: 'deleted' } });
  await postToMl('delete-model', {}, 7);
  expect(axios.post.mock.calls.map(call => call[0])).toEqual([
    'http://127.0.0.1:8000/delete-model', 'http://127.0.0.1:8001/delete-model'
  ]);
  axios.post.mockImplementation(url => url.includes(':8001')
    ? Promise.reject(new Error('offline')) : Promise.resolve({ data: { status: 'deleted' } }));
  await expect(postToMl('delete-model', {}, 7)).rejects.toThrow('offline');
});
