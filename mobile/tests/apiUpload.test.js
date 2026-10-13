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

describe('Upload mobile', () => {
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
  });

  test('ne lance pas de requête sans session', async () => {
    const { api, fetch } = createApi(null);
    await expect(api.uploadImage('file:///image-test.jpg'))
      .rejects.toThrow('Connexion requise');
    expect(fetch).not.toHaveBeenCalled();
  });
});
