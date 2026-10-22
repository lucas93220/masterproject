jest.mock('../models/log', () => ({ db: { readyState: 1 }, create: jest.fn() }));
const Log = require('../models/log');
const { recordDisplayedPrediction } = require('../services/predictionTrace');

beforeEach(() => {
  jest.clearAllMocks();
  Log.db.readyState = 1;
});

test('enregistre seulement le score de la tenue affichée, lié au compte', async () => {
  Log.create.mockResolvedValue({});
  expect(await recordDisplayedPrediction({ userId: 7, outfitId: 22,
    prediction: { probability_like: 0.7, model_used: 'personalized',
      model_variant: 'items-pairs-v1', model_revision: 'revision-1' },
    featureVersion: 'outfit-v2-test' })).toBe(true);
  expect(Log.create).toHaveBeenCalledWith({ userId: '7', action: 'outfit_prediction',
    details: { id_tenue: 22, probability_like: 0.7, model_used: 'personalized',
      model_variant: 'items-pairs-v1', model_revision: 'revision-1',
      feature_version: 'outfit-v2-test' } });
});

test('Mongo indisponible ne bloque pas la génération', async () => {
  Log.db.readyState = 0;
  expect(await recordDisplayedPrediction({ userId: 7 })).toBe(false);
  expect(Log.create).not.toHaveBeenCalled();
});

test('un échec d’écriture de la trace reste non bloquant', async () => {
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  Log.create.mockRejectedValueOnce(new Error('Mongo indisponible'));
  expect(await recordDisplayedPrediction({ userId: 7, outfitId: 22,
    prediction: { probability_like: 0.7, model_used: 'personalized' },
    featureVersion: 'outfit-v2-test' })).toBe(false);
  expect(errorLog).toHaveBeenCalledWith('Trace de prédiction MongoDB indisponible');
  errorLog.mockRestore();
});
