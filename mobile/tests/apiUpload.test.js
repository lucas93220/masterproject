/* global __dirname, jest, describe, test, expect */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../node_modules/typescript');

const sourcePath = path.join(__dirname, '../src/services/api.js');
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
});

function createApi(token) {
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
    exports, FormData, fetch,
    require: name => {
      if (name !== '@react-native-async-storage/async-storage') throw new Error(name);
      return { default: { getItem } };
    }
  }, { filename: sourcePath });
  return { api: exports, fetch, getItem };
}

describe('API mobile', () => {
  test('transmet le code météo lors de la génération sans rompre l’ancien appel', async () => {
    const { api, fetch } = createApi('jeton-fictif');
    await api.generateTenue(9, '01d');
    await api.generateTenue(9);
    expect(fetch.mock.calls[0][0]).toBe(
      'http://192.168.1.181:3002/api/tenue/generate?temperature=9&weatherIcon=01d');
    expect(fetch.mock.calls[1][0]).toBe(
      'http://192.168.1.181:3002/api/tenue/generate?temperature=9');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer jeton-fictif');
  });

  test('les images privées portent le JWT ; aucun jeton ne part vers une URL externe', async () => {
    const { api } = createApi('jeton-fictif');
    expect(await api.imageSource('/uploads/test.jpg')).toEqual({
      uri: 'http://192.168.1.181:3002/uploads/test.jpg',
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
      .toBe('http://192.168.1.181:3002/uploads/image.jpg');
    expect(api.resolveImageUrl('https://example.invalid/uploads/image.jpg'))
      .toBe('https://example.invalid/uploads/image.jpg');
    expect(api.resolveImageUrl('file:///ancienne/photo.heic'))
      .toBe('file:///ancienne/photo.heic');
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
