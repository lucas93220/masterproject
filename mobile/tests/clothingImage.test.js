/* global __dirname, jest, test, expect */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../node_modules/typescript');
const source = path.join(__dirname, '../src/components/ClothingImage.js');
const compiled = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
  fileName: 'ClothingImage.jsx', compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020
  }
}).outputText;
function component(platform, resolved) {
  let state = null, effect;
  const fetch = jest.fn().mockResolvedValue({ ok: true, blob: async () => 'fake-blob' });
  const URL = { createObjectURL: jest.fn(() => 'blob:fake-image'), revokeObjectURL: jest.fn() };
  const elements = (type, props) => ({ type, props });
  const dependencies = {
    react: { useState: () => [state, value => { state = value; }],
      useEffect: callback => { effect = callback; } },
    'react/jsx-runtime': { jsx: elements, jsxs: elements },
    'react-native': { Image: 'Image', View: 'View', Text: 'Text', Platform: { OS: platform } },
    '../styles/colors': { COLORS: {} },
    '../services/api': { imageSource: jest.fn().mockResolvedValue(resolved) }
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, URL, fetch,
    require: name => dependencies[name] }, { filename: source });
  const render = (uri = 'fixture.jpg') => exports.default({ uri, style: { width: 100 } });
  render();
  const cleanup = effect();
  return { render, cleanup, fetch, URL };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
test('mobile natif : en-tête privé dans la source, aucun téléchargement web', async () => {
  const source = { uri: 'http://test.invalid/uploads/test.jpg', headers: { Authorization: 'Bearer test' } };
  const screen = component('ios', source);
  await flush();
  expect(screen.render()).toMatchObject({ type: 'Image', props: { source } });
  expect(screen.fetch).not.toHaveBeenCalled();
  screen.cleanup();
});
test('web : téléchargement authentifié sans cache, URL blob libérée au démontage', async () => {
  const source = { uri: 'http://test.invalid/uploads/test.jpg', headers: { Authorization: 'Bearer test' } };
  const screen = component('web', source);
  await flush();
  expect(screen.fetch).toHaveBeenCalledWith(source.uri, { headers: source.headers, cache: 'no-store' });
  expect(screen.render().props.source).toEqual({ uri: 'blob:fake-image' });
  screen.cleanup();
  expect(screen.URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-image');
});
test('une image extérieure conserve une source sans jeton', async () => {
  const screen = component('web', { uri: 'https://example.invalid/image.jpg' });
  await flush();
  expect(screen.fetch).not.toHaveBeenCalled();
  expect(screen.render().props.source).toEqual({ uri: 'https://example.invalid/image.jpg' });
});
test('session absente et changement d’image : aucun affichage de la précédente', async () => {
  const absent = component('web', null);
  await flush();
  expect(absent.render().type).toBe('View');
  const screen = component('ios', { uri: 'file:///fixture.jpg' });
  await flush();
  expect(screen.render('another.jpg').type).toBe('View');
});
test('démontage pendant le chargement : la ressource tardive est libérée', async () => {
  const screen = component('web', { uri: 'http://test.invalid/uploads/test.jpg', headers: { Authorization: 'Bearer test' } });
  screen.cleanup();
  await flush();
  expect(screen.URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-image');
  expect(screen.render().type).toBe('View');
});
