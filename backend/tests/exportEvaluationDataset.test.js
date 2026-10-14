const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../config/db', () => ({
  sequelize: { query: jest.fn(), close: jest.fn() },
  mongoose: { disconnect: jest.fn() }
}));
jest.mock('../models', () => ({}));
jest.mock('../services/outfitFeatures', () => ({ loadFeatureSchema: jest.fn() }));
jest.mock('../services/trainingDataset', () => ({ buildTrainingDataset: jest.fn() }));

const { sequelize, mongoose } = require('../config/db');
const { loadFeatureSchema } = require('../services/outfitFeatures');
const { buildTrainingDataset } = require('../services/trainingDataset');
const { main } = require('../scripts/exportEvaluationDataset');

const names = ['DB_HOST', 'DB_NAME', 'NODE_ENV'];
let previousEnv;
let previousArgv;
let temporaryDirectory;

beforeEach(() => {
  previousEnv = Object.fromEntries(names.map(name => [name, process.env[name]]));
  previousArgv = process.argv;
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'fits-evaluation-test-'));
  process.env.DB_HOST = 'localhost';
  process.env.DB_NAME = 'fits';
  delete process.env.NODE_ENV;
  sequelize.query.mockResolvedValue([[{ database: 'fits', address: '::1' }]]);
  sequelize.close.mockResolvedValue();
  mongoose.disconnect.mockResolvedValue();
  loadFeatureSchema.mockResolvedValue({ version: 'outfit-v2-test' });
  buildTrainingDataset.mockResolvedValue([{ temperature: 18, is_liked: 1, id_tenue: 12 }]);
});

afterEach(() => {
  for (const name of names) {
    if (previousEnv[name] === undefined) delete process.env[name];
    else process.env[name] = previousEnv[name];
  }
  process.argv = previousArgv;
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  jest.clearAllMocks();
});

test('exporte les lignes groupables sans écriture en base', async () => {
  const output = path.join(temporaryDirectory, 'avis.json');
  process.argv = ['node', 'script', '7', output];
  const log = jest.spyOn(console, 'log').mockImplementation();
  try {
    await main();
  } finally {
    log.mockRestore();
  }

  expect(sequelize.query).toHaveBeenCalledTimes(1);
  expect(sequelize.query.mock.calls[0][0]).toMatch(/^SELECT /);
  expect(buildTrainingDataset).toHaveBeenCalledWith(7,
    { version: 'outfit-v2-test' }, { includeTenueId: true });
  expect(JSON.parse(fs.readFileSync(output, 'utf8'))).toEqual(expect.objectContaining({
    user_id: 7, feature_version: 'outfit-v2-test',
    data: [{ temperature: 18, is_liked: 1, id_tenue: 12 }]
  }));
  expect(fs.statSync(output).mode & 0o777).toBe(0o600);
  expect(sequelize.close).toHaveBeenCalled();
  expect(mongoose.disconnect).toHaveBeenCalled();
});

test('refuse un chemin dans le dépôt ou une cible distante avant toute connexion', async () => {
  process.argv = ['node', 'script', '7', path.join(__dirname, 'avis.json')];
  await expect(main()).rejects.toThrow('hors du dépôt');
  process.argv = ['node', 'script', '7', path.join(temporaryDirectory, 'avis.json')];
  process.env.DB_HOST = 'db.example.com';
  await expect(main()).rejects.toThrow('réservé à la base');
  expect(sequelize.query).not.toHaveBeenCalled();
});

test('le mode interactions exporte des identifiants privés sans changer le mode historique', async () => {
  const output = path.join(temporaryDirectory, 'interactions.json');
  process.argv = ['node', 'script', '7', output, '--interactions'];
  buildTrainingDataset.mockImplementation(async (_userId, _schema, options) =>
    options.includeInteractionMetadata ? [{ temperature: 18, is_liked: 1, id_tenue: 12,
      garment_ids: [101, 102], garment_ids_source: 'snapshot',
      reviewed_at: '2026-10-14T08:00:00.000Z' }] : [
      { temperature: 18, is_liked: 1, id_tenue: 12 },
      { temperature: 19, is_liked: 0, id_tenue: 13 }
    ]);
  const log = jest.spyOn(console, 'log').mockImplementation();
  try { await main(); } finally { log.mockRestore(); }

  expect(buildTrainingDataset).toHaveBeenCalledWith(7, { version: 'outfit-v2-test' },
    { includeTenueId: true, includeInteractionMetadata: true });
  expect(JSON.parse(fs.readFileSync(output, 'utf8'))).toEqual(expect.objectContaining({
    format: 'fits-interactions-v1', user_id: 7,
    n_v2_rows: 2, n_excluded_for_interactions: 1,
    data: [expect.objectContaining({ garment_ids: [101, 102] })]
  }));
  expect(fs.statSync(output).mode & 0o777).toBe(0o600);
});
