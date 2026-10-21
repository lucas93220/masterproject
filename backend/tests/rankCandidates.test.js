jest.mock('../services/mlClient', () => ({ postToMl: jest.fn() }));
jest.mock('../services/outfitFeatures', () => ({ extractFeatures: jest.fn(row => ({ ratio_favoris: row[0].ratio_favoris })) }));
const { postToMl } = require('../services/mlClient');
const { rankCandidates } = require('../services/rankCandidates');
const candidates = [
  { id_vetement: 1, ratio_favoris: 0.2 },
  { id_vetement: 2, ratio_favoris: 0.8 },
  { id_vetement: 3, ratio_favoris: 0.4 }
].map(row => [row]);
beforeEach(() => jest.clearAllMocks());

test('un lot personnel choisit le meilleur score avec les identités serveur', async () => {
  postToMl.mockResolvedValue({ data: { predictions: [0.9, 0.1, 0.6].map(probability_like =>
    ({ probability_like, model_used: 'personalized', model_variant: 'items-pairs-v1', model_revision: 'one' })) } });
  const result = await rankCandidates(candidates, 18, { version: 'outfit-v2-test' }, 7);
  expect(result.candidate).toBe(candidates[0]);
  expect(result.prediction.model_used).toBe('personalized');
  expect(postToMl).toHaveBeenCalledWith('predict-batch', expect.objectContaining({
    representation_version: 'items-pairs-v1',
    candidates: [expect.objectContaining({ garment_ids: [1] }),
      expect.objectContaining({ garment_ids: [2] }),
      expect.objectContaining({ garment_ids: [3] })]
  }), 7);
  expect(postToMl).toHaveBeenCalledTimes(1);
});
test('une panne du lot donne le fallback à toutes les tenues', async () => {
  postToMl.mockRejectedValue(new Error('ECONNREFUSED'));
  const result = await rankCandidates(candidates, 18, { version: 'outfit-v2-test' }, 7);
  expect(result.candidate).toBe(candidates[1]);
  expect(result.prediction).toEqual({ probability_like: 0.8, model_used: 'fallback', reason: 'ml_unavailable' });
  expect(postToMl).toHaveBeenCalledTimes(1);
});
test.each([NaN, '0.8', -1, 1.1])('score ML invalide %p : fallback explicite', async probability_like => {
  postToMl.mockResolvedValue({ data: { predictions: candidates.map(() =>
    ({ probability_like, model_used: 'personalized', model_variant: 'items-pairs-v1', model_revision: 'one' })) } });
  expect((await rankCandidates(candidates, 18, { version: 'outfit-v2-test' }, 7))
    .prediction.reason).toBe('ml_unavailable');
  expect(postToMl).toHaveBeenCalledTimes(1);
});
test('un score personnalisé sans version articles/paires ne peut pas classer la tenue', async () => {
  postToMl.mockResolvedValue({ data: { predictions: candidates.map(() => ({
    probability_like: 0.9, model_used: 'personalized', model_variant: 'random-forest'
  })) } });
  const result = await rankCandidates(candidates, 18, { version: 'outfit-v2-test' }, 7);
  expect(result.candidate).toBe(candidates[1]);
  expect(result.prediction.reason).toBe('ml_unavailable');
});
test('modèle indisponible dans une réponse mixte : tout le lot revient au fallback', async () => {
  postToMl.mockResolvedValue({ data: { predictions: [
    { probability_like: 0.99, model_used: 'personalized', model_variant: 'items-pairs-v1', model_revision: 'one' },
    { probability_like: 0.1, model_used: 'fallback', reason: 'no_model' },
    { probability_like: 0.3, model_used: 'fallback', reason: 'no_model' }
  ] } });
  const result = await rankCandidates(candidates, 18, { version: 'outfit-v2-test' }, 7);
  expect(result.candidate).toBe(candidates[1]);
  expect(result.prediction.reason).toBe('inconsistent_batch');
});
