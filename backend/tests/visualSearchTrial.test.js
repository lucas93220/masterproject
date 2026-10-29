const { searchVisualMatches, validateImage, MAX_TRIAL_BYTES } = require('../services/visualSearchTrial');
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const ok = data => ({ ok: true, json: async () => data });

test('envoie une image locale puis interroge Lens sans URL publique ni indice de marque', async () => {
  const fetchImpl = jest.fn().mockResolvedValueOnce(ok({ image_id: 'test-image' }))
    .mockResolvedValueOnce(ok({ visual_matches: [{ title: 'Produit fictif', source: 'Catalogue test', link: 'https://example.invalid/product' }],
      search_metadata: { private_key: 'test-key' } }));
  const result = await searchVisualMatches(jpeg, { apiKey: 'test-key', fetchImpl });
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  const [url, options] = fetchImpl.mock.calls[0];
  expect(url).toBe('https://serpapi.com/image');
  expect(options.redirect).toBe('error');
  expect(options.body.get('image').name).toBe('image.jpg');
  expect(Buffer.from(await options.body.get('image').arrayBuffer())).toEqual(jpeg);
  const search = new URL(fetchImpl.mock.calls[1][0]);
  expect(search.searchParams.get('image_id')).toBe('test-image');
  expect(search.searchParams.get('type')).toBe('visual_matches');
  expect(search.searchParams.has('url')).toBe(false);
  expect(search.searchParams.has('q')).toBe(false);
  expect(result).toMatchObject({ identification_confirmed: false, matches: [{ rank: 1, title: 'Produit fictif' }] });
  expect(JSON.stringify(result)).not.toMatch(/test-key|private_key|test-image/);
});

test.each([Buffer.from('pas une image'), Buffer.alloc(MAX_TRIAL_BYTES + 1), Buffer.alloc(0)])(
  'rejette une image invalide sans appel externe', async buffer => {
    const fetchImpl = jest.fn();
    await expect(searchVisualMatches(buffer, { apiKey: 'test', fetchImpl })).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  }
);

test('exige une clé avant tout envoi', async () => {
  const fetchImpl = jest.fn();
  await expect(searchVisualMatches(jpeg, { fetchImpl })).rejects.toThrow('SERPAPI_API_KEY');
  expect(fetchImpl).not.toHaveBeenCalled();
});

test.each([{ ok: false }, ok({ error: 'secret-fournisseur' })])('ne propage pas une erreur fournisseur et ne réessaie pas', async response => {
  const fetchImpl = jest.fn().mockResolvedValue(response);
  await expect(searchVisualMatches(jpeg, { apiKey: 'secret', fetchImpl })).rejects.toThrow('indisponible');
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test('masque une exception réseau contenant une clé', async () => {
  const fetchImpl = jest.fn().mockRejectedValue(new Error('https://serpapi.com/?api_key=secret'));
  await expect(searchVisualMatches(jpeg, { apiKey: 'secret', fetchImpl })).rejects.not.toThrow('api_key');
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test('refuse un identifiant absent et ne lance pas de recherche supplémentaire', async () => {
  const fetchImpl = jest.fn().mockResolvedValue(ok({}));
  await expect(searchVisualMatches(jpeg, { apiKey: 'test', fetchImpl })).rejects.toThrow('identifiant');
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test('une recherche vide reste un résultat explicite sans identification inventée', async () => {
  const fetchImpl = jest.fn().mockResolvedValueOnce(ok({ image_id: 'test' })).mockResolvedValueOnce(ok({}));
  expect(await searchVisualMatches(jpeg, { apiKey: 'test', fetchImpl })).toMatchObject({ status: 'no_matches', matches: [], identification_confirmed: false });
});

test('filtre les liens dangereux, les doublons et limite à cinq pistes', async () => {
  const items = [{ title: 'Interdit', link: 'javascript:alert(1)' }, { title: 'Interdit', link: 'https://secret:secret@example.invalid' }, null,
    ...Array.from({ length: 10 }, (_, i) => ({ title: `Article ${i}\n`, link: `https://example.invalid/${i}` }))];
  items.push(items[3]);
  const fetchImpl = jest.fn().mockResolvedValueOnce(ok({ image_id: 'test' })).mockResolvedValueOnce(ok({ visual_matches: items }));
  const result = await searchVisualMatches(jpeg, { apiKey: 'test', fetchImpl });
  expect(result.matches).toHaveLength(5);
  expect(result.matches[0]).toMatchObject({ title: 'Article 0', rank: 1 });
});

test('la vérification locale du script ne charge pas de secret et ne déclenche aucun appel réseau', async () => {
  const fs = require('node:fs/promises');
  const os = require('node:os');
  const path = require('node:path');
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'fits-visual-trial-'));
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  const network = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Envoi interdit'));
  try {
    const file = path.join(folder, 'test.jpg');
    await fs.writeFile(file, jpeg);
    await require('../scripts/testVisualSearch').main(['--image', file]);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Aucun envoi'));
    expect(network).not.toHaveBeenCalled();
    expect(validateImage(jpeg).contentType).toBe('image/jpeg');
  } finally {
    log.mockRestore(); network.mockRestore();
    await fs.rm(folder, { recursive: true, force: true });
  }
});
