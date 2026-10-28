/* global __dirname, jest, describe, test, expect */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../node_modules/typescript');

const sourcePath = path.join(__dirname, '../src/services/api.js');
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
});

function createApi(token, { hostUri = '192.168.1.17:8081', publicApiUrl } = {}) {
  const fetch = jest.fn().mockResolvedValue({
    ok: true, json: async () => ({ imageUrl: 'http://example.invalid/uploads/image.jpg' })
  });
  const getItem = jest.fn().mockResolvedValue(token);
  class FormData {
    constructor() { this.entries = []; }
    append(...args) { this.entries.push(args); }
  }
  const exports = {};
  vm.runInNewContext(compiled.outputText, {
    exports, FormData, fetch, AbortController, setTimeout, clearTimeout,
    process: { env: { EXPO_PUBLIC_API_URL: publicApiUrl } },
    require: name => {
      if (name === '@react-native-async-storage/async-storage') return { default: { getItem } };
      if (name === 'expo-constants') return { default: { expoConfig: { hostUri } } };
      throw new Error(name);
    }
  }, { filename: sourcePath });
  return { api: exports, fetch, getItem };
}

describe('API mobile', () => {
  test('supprime le compte authentifié et accepte un nettoyage différé', async () => {
    const { api, fetch } = createApi('jeton-fictif');
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 202,
      json: async () => ({ message: 'Compte supprimé ; nettoyage annexe en attente.' })
    });
    await expect(api.deleteMyAccount()).resolves.toEqual({
      message: 'Compte supprimé ; nettoyage annexe en attente.'
    });
    expect(fetch).toHaveBeenCalledWith(
      'http://192.168.1.17:3002/api/utilisateur/me',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({ Authorization: 'Bearer jeton-fictif' })
      })
    );
  });

  test('transmet le code météo lors de la génération sans rompre l’ancien appel', async () => {
    const { api, fetch } = createApi('jeton-fictif');
    await api.generateTenue(9, '01d');
    await api.generateTenue(9);
    expect(fetch.mock.calls[0][0]).toBe(
      'http://192.168.1.17:3002/api/tenue/generate?temperature=9&weatherIcon=01d');
    expect(fetch.mock.calls[1][0]).toBe(
      'http://192.168.1.17:3002/api/tenue/generate?temperature=9');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer jeton-fictif');
  });

  test('les images privées portent le JWT ; aucun jeton ne part vers une URL externe', async () => {
    const { api } = createApi('jeton-fictif');
    expect(await api.imageSource('/uploads/test.jpg')).toEqual({
      uri: 'http://192.168.1.17:3002/uploads/test.jpg',
      headers: { Authorization: 'Bearer jeton-fictif' }, cache: 'reload'
    });
    expect(await api.imageSource('https://example.invalid/uploads/test.jpg'))
      .toEqual({ uri: 'https://example.invalid/uploads/test.jpg' });
    expect(await api.imageSource('file:///photo.jpg')).toEqual({ uri: 'file:///photo.jpg' });
    expect(await createApi(null).api.imageSource('/uploads/test.jpg')).toBeNull();
  });
  test('réadresse une ancienne URL /uploads vers le backend actuel', () => {
    const { api } = createApi(null);
    expect(api.resolveImageUrl('http://10.190.5.20:3002/uploads/image.jpg'))
      .toBe('http://192.168.1.17:3002/uploads/image.jpg');
    expect(api.resolveImageUrl('http://192.168.1.181:3002/uploads/1760961600000-abcde.jpg'))
      .toBe('http://192.168.1.17:3002/uploads/1760961600000-abcde.jpg');
    expect(api.resolveImageUrl('https://example.invalid/uploads/image.jpg'))
      .toBe('https://example.invalid/uploads/image.jpg');
    expect(api.resolveImageUrl('file:///ancienne/photo.heic'))
      .toBe('file:///ancienne/photo.heic');
  });

  test('suit l’adresse du serveur Expo après un changement de réseau', async () => {
    const { api, fetch } = createApi(null, { hostUri: '192.168.50.24:8081' });
    await api.loginUser('test@example.invalid', 'fictif');
    expect(fetch.mock.calls[0][0]).toBe('http://192.168.50.24:3002/api/auth/login');
  });

  test('permet une adresse API explicite quand Expo utilise un tunnel', async () => {
    const { api, fetch } = createApi(null, {
      hostUri: 'abc.exp.direct:8081',
      publicApiUrl: 'https://api.example.invalid/api'
    });
    await api.loginUser('test@example.invalid', 'fictif');
    expect(fetch.mock.calls[0][0]).toBe('https://api.example.invalid/api/auth/login');
  });

  test('ne déduit pas une adresse API du domaine d’un tunnel Expo', async () => {
    const { api, fetch } = createApi(null, { hostUri: 'abc.exp.direct:8081' });
    await api.loginUser('test@example.invalid', 'fictif');
    expect(fetch.mock.calls[0][0]).toBe('http://192.168.1.17:3002/api/auth/login');
  });

  test('transmet le JWT sans fixer Content-Type du multipart', async () => {
    const { api, fetch } = createApi('jeton-fictif');
    const imageUrl = await api.uploadImage('file:///image-test.jpg');
    expect(imageUrl).toBe('http://example.invalid/uploads/image.jpg');
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toMatch(/\/api\/upload$/);
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer jeton-fictif');
    expect(options.headers).not.toHaveProperty('Content-Type');
    expect(options.body.entries[0][0]).toBe('image');
    expect(options.body.entries[0][1]).toEqual({
      uri: 'file:///image-test.jpg', name: 'photo.jpg', type: 'image/jpeg'
    });
  });

  test('annonce correctement un PNG et refuse un HEIC avant la requête', async () => {
    const { api, fetch } = createApi('jeton-fictif');
    await api.uploadImage('file:///image-test.png', 'image/png');
    expect(fetch.mock.calls[0][1].body.entries[0][1]).toEqual({
      uri: 'file:///image-test.png', name: 'photo.png', type: 'image/png'
    });
    await expect(api.uploadImage('file:///image-test.heic', 'image/heic'))
      .rejects.toThrow('Format image non pris en charge');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('ne lance pas de requête sans session', async () => {
    const { api, fetch } = createApi(null);
    await expect(api.uploadImage('file:///image-test.jpg'))
      .rejects.toThrow('Connexion requise');
    expect(fetch).not.toHaveBeenCalled();
  });
});

test('envoie un Blob de photothèque web en multipart, sans JWT sur sa lecture locale', async () => {
  const { api, fetch } = createApi('jeton-fictif');
  const blob = { type: 'image/png', fixture: true };
  fetch.mockResolvedValueOnce({ ok: true, blob: async () => blob });
  await api.uploadImage('blob:http://localhost/fixture', 'image/png');
  expect(fetch.mock.calls[0]).toEqual(['blob:http://localhost/fixture']);
  expect(fetch.mock.calls[1][1].body.entries[0]).toEqual(['image', blob, 'photo.png']);
  expect(fetch.mock.calls[1][1].headers).toEqual({ Authorization: 'Bearer jeton-fictif' });
});

test('ne téléverse pas une photo web illisible', async () => {
  const { api, fetch } = createApi('jeton-fictif');
  fetch.mockResolvedValueOnce({ ok: false });
  await expect(api.uploadImage('blob:http://localhost/fixture', 'image/jpeg')).rejects.toThrow('Impossible de lire');
  expect(fetch).toHaveBeenCalledTimes(1);
});

describe('Analyse photo mobile', () => {
  test('utilise une route authentifiée distincte sans stocker la photo via upload', async () => {
    const { api, fetch } = createApi('jeton-fictif');
    const suggestion = { nom: 'Pull noir', marque: null, couleur: 'noir', id_sous_categorie: 3 };
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ suggestion }) });
    await expect(api.analyzeClothingImage('file:///pull.png', 'image/png')).resolves.toEqual(suggestion);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('http://192.168.1.17:3002/api/clothing-analysis');
    expect(options.headers).toEqual({ Authorization: 'Bearer jeton-fictif' });
    expect(options.body.entries[0]).toEqual(['image', { uri: 'file:///pull.png', name: 'photo.png', type: 'image/png' }]);
    expect(options.signal.aborted).toBe(false);
  });
  test('supporte une photo web avec le même transport multipart', async () => {
    const { api, fetch } = createApi('jeton-fictif');
    const blob = { type: 'image/jpeg', fixture: true };
    fetch.mockResolvedValueOnce({ ok: true, blob: async () => blob });
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ suggestion: { nom: 'Pull' } }) });
    await api.analyzeClothingImage('blob:http://localhost/fixture', 'image/jpeg');
    expect(fetch.mock.calls[0]).toEqual(['blob:http://localhost/fixture']);
    expect(fetch.mock.calls[1][1].body.entries[0]).toEqual(['image', blob, 'photo.jpg']);
  });
  test('refuse une analyse sans session', async () => {
    const { api, fetch } = createApi(null);
    await expect(api.analyzeClothingImage('file:///pull.jpg')).rejects.toThrow('Connexion requise');
    expect(fetch).not.toHaveBeenCalled();
  });
  test('relaie les erreurs exploitables et rejette une réponse malformée', async () => {
    const { api, fetch } = createApi('jeton-fictif');
    fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ message: 'Analyse indisponible. Continue manuellement.' }) });
    await expect(api.analyzeClothingImage('file:///pull.jpg')).rejects.toThrow('Continue manuellement');
    await expect(api.analyzeClothingImage('file:///pull.jpg')).rejects.toThrow('Analyse photo illisible');
  });
  test('interrompt une requête qui dépasse 45 secondes', async () => {
    jest.useFakeTimers();
    try {
      const { api, fetch } = createApi('jeton-fictif');
      fetch.mockImplementationOnce((url, options) => new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(Object.assign(new Error('timeout'), { name: 'AbortError' })));
      }));
      const pending = api.analyzeClothingImage('file:///pull.jpg');
      const assertion = expect(pending).rejects.toThrow('prend trop de temps');
      await jest.advanceTimersByTimeAsync(45001);
      await assertion;
      expect(jest.getTimerCount()).toBe(0);
    } finally { jest.useRealTimers(); }
  });
});
