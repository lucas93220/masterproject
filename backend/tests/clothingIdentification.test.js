jest.mock('../services/clothingRecognition', () => ({ recognizeClothing: jest.fn() }));
jest.mock('../services/visualSearchTrial', () => ({ searchVisualMatches: jest.fn() }));
jest.mock('../services/prepareVisualSearchImage', () => ({ prepareVisualSearchBuffer: jest.fn() }));
const { recognizeClothing } = require('../services/clothingRecognition');
const { searchVisualMatches } = require('../services/visualSearchTrial');
const { prepareVisualSearchBuffer } = require('../services/prepareVisualSearchImage');
const { identifyClothing } = require('../services/clothingIdentification');
const file = { buffer: Buffer.from('fixture'), mimetype: 'image/jpeg' };
const catalog = [{ id_sous_categorie: 1 }];
const matches = [{ rank: 1, title: 'Article fictif', source: 'Catalogue', link: 'https://example.invalid' }];
const previous = { key: process.env.SERPAPI_API_KEY, flag: process.env.CLOTHING_VISUAL_SEARCH };
beforeEach(() => {
  jest.resetAllMocks();
  process.env.SERPAPI_API_KEY = 'fictif'; delete process.env.CLOTHING_VISUAL_SEARCH;
  prepareVisualSearchBuffer.mockResolvedValue({ buffer: file.buffer });
  searchVisualMatches.mockResolvedValue({ status: 'matches', matches });
  recognizeClothing.mockResolvedValue({ nom: 'Article', couleur: 'noir' });
});
afterAll(() => {
  for (const [key, value] of [['SERPAPI_API_KEY', previous.key], ['CLOTHING_VISUAL_SEARCH', previous.flag]]) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

test('recherche automatiquement puis transmet les indices à une seule analyse Gemini', async () => {
  const result = await identifyClothing(file, catalog);
  expect(prepareVisualSearchBuffer).toHaveBeenCalledWith(file.buffer, { signal: expect.any(AbortSignal) });
  expect(searchVisualMatches).toHaveBeenCalledWith(file.buffer, { apiKey: 'fictif', signal: expect.any(AbortSignal) });
  expect(recognizeClothing).toHaveBeenCalledWith(file, catalog, { visualMatches: matches });
  expect(recognizeClothing).toHaveBeenCalledTimes(1);
  expect(result).toEqual({ suggestion: { nom: 'Article', couleur: 'noir' }, visual_search: { status: 'matches' } });
});

test.each(['prepare', 'search'])('préserve Gemini après panne ou délai de %s', async stage => {
  (stage === 'prepare' ? prepareVisualSearchBuffer : searchVisualMatches).mockRejectedValueOnce(new Error('clé-secrète'));
  const result = await identifyClothing(file, catalog);
  expect(result.visual_search).toEqual({ status: 'unavailable' });
  expect(recognizeClothing).toHaveBeenCalledWith(file, catalog, { visualMatches: [] });
  expect(JSON.stringify(result)).not.toContain('clé-secrète');
});

test.each(['missing', 'disabled'])('sans clé ou après désactivation : aucun appel SerpApi (%s)', async reason => {
  if (reason === 'missing') delete process.env.SERPAPI_API_KEY;
  else process.env.CLOTHING_VISUAL_SEARCH = '0';
  expect((await identifyClothing(file, catalog)).visual_search.status).toBe('disabled');
  expect(prepareVisualSearchBuffer).not.toHaveBeenCalled();
  expect(searchVisualMatches).not.toHaveBeenCalled();
  expect(recognizeClothing).toHaveBeenCalledTimes(1);
});

test('absence de correspondance : description photo et statut explicite', async () => {
  searchVisualMatches.mockResolvedValue({ status: 'no_matches', matches: [] });
  const result = await identifyClothing(file, catalog);
  expect(result.visual_search.status).toBe('no_matches');
  expect(result.suggestion.nom).toBe('Article');
});


test('réutilise la copie JPEG pour Gemini, y compris après une panne SerpApi', async () => {
  const compact = Buffer.from('copie-jpeg');
  prepareVisualSearchBuffer.mockResolvedValue({ buffer: compact, compressed: true });
  searchVisualMatches.mockRejectedValueOnce(new Error('panne'));
  const result = await identifyClothing(file, catalog);
  expect(recognizeClothing).toHaveBeenCalledWith(expect.objectContaining({ buffer: compact, mimetype: 'image/jpeg', size: compact.length }), catalog, { visualMatches: [] });
  expect(prepareVisualSearchBuffer).toHaveBeenCalledTimes(1);
  expect(file.buffer.toString()).toBe('fixture');
  expect(result.visual_search).toEqual({ status: 'unavailable' });
});

test('les diagnostics ne contiennent que les durées, pas les références ni la clé', async () => {
  const info = jest.spyOn(console, 'info').mockImplementation(() => {});
  try {
    await identifyClothing(file, catalog);
    expect(info).toHaveBeenCalledWith('[FITS Photo]', {
      preparation_ms: expect.any(Number), recherche_ms: expect.any(Number), gemini_ms: expect.any(Number), total_ms: expect.any(Number)
    });
    expect(JSON.stringify(info.mock.calls)).not.toMatch(/fictif|Catalogue|example.invalid/);
  } finally { info.mockRestore(); }
});
