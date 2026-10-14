jest.mock('../services/mlClient', () => ({ postToMl: jest.fn() }));
jest.mock('../services/outfitFeatures', () => ({ extractFeatures: jest.fn(row => row) }));
const { postToMl } = require('../services/mlClient');
const { rankCandidates } = require('../services/rankCandidates');
const candidates = [{ ratio_favoris: 0.2 }, { ratio_favoris: 0.8 }, { ratio_favoris: 0.4 }];
beforeEach(() => jest.clearAllMocks());
test('un score personnel choisit le maximum, avec la même identité pour tout le lot', async () => {
  for (const probability_like of [0.9, 0.1, 0.6]) {
    postToMl.mockResolvedValueOnce({ data: { probability_like, model_used: 'personalized' } });
  }
  const result = await rankCandidates(candidates, 18, { version: 'outfit-v2-test' }, 7);
  expect(result.candidate).toBe(candidates[0]);
  expect(result.prediction.model_used).toBe('personalized');
  for (const args of postToMl.mock.calls) expect(args[2]).toBe(7);
});
test('panne à mi-lot : recalcule tous les scores par favoris, sans les mélanger au RF', async () => {
  postToMl.mockResolvedValueOnce({ data: { probability_like: 0.99, model_used: 'personalized' } });
  postToMl.mockRejectedValueOnce(new Error('ECONNREFUSED'));
  const result = await rankCandidates(candidates, 18, { version: 'outfit-v2-test' }, 7);
  expect(result.candidate).toBe(candidates[1]);
  expect(result.prediction).toEqual({ probability_like: 0.8, model_used: 'fallback', reason: 'ml_unavailable' });
  expect(postToMl).toHaveBeenCalledTimes(2);
});
test.each([NaN, '0.8', -1, 1.1])('score ML invalide %p : fallback explicite', async probability_like => {
  postToMl.mockResolvedValue({ data: { probability_like, model_used: 'personalized' } });
  expect((await rankCandidates(candidates, 18, { version: 'outfit-v2-test' }, 7))
    .prediction.reason).toBe('ml_unavailable');
  expect(postToMl).toHaveBeenCalledTimes(1);
});
test('modèle indisponible en milieu de lot : toutes les tenues utilisent le même fallback', async () => {
  postToMl.mockResolvedValueOnce({ data: { probability_like: 0.99, model_used: 'personalized' } });
  postToMl.mockResolvedValue({ data: { probability_like: 0.1, model_used: 'fallback', reason: 'no_model' } });
  const result = await rankCandidates(candidates, 18, { version: 'outfit-v2-test' }, 7);
  expect(result.candidate).toBe(candidates[1]);
  expect(result.prediction.reason).toBe('inconsistent_batch');
});
