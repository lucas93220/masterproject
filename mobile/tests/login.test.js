/* global __dirname, jest, describe, test, expect */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../node_modules/typescript');

const sourcePath = path.join(__dirname, '../src/screens/login.js');
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  fileName: 'login.jsx',
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2020
  },
  reportDiagnostics: true
});
if (compiled.diagnostics.length) throw new Error('Compilation de login.js impossible');

function createScreen(loginUser) {
  const alert = jest.fn();
  const setItem = jest.fn().mockResolvedValue();
  const replace = jest.fn();
  const native = { Alert: { alert }, Platform: { OS: 'ios' } };
  for (const name of ['View', 'Text', 'TextInput', 'KeyboardAvoidingView',
    'ScrollView', 'TouchableOpacity', 'SafeAreaView', 'ActivityIndicator']) {
    native[name] = name;
  }
  const exports = {};
  vm.runInNewContext(compiled.outputText, {
    exports,
    require: name => {
      if (name === 'react') return { useState: initial => [initial, jest.fn()] };
      if (name === 'react/jsx-runtime') return {
        jsx: (type, props) => ({ type, props }),
        jsxs: (type, props) => ({ type, props })
      };
      if (name === 'react-native') return native;
      if (name === '@react-native-async-storage/async-storage') return { default: { setItem } };
      if (name === '../services/api') return { loginUser };
      if (name === '../styles/colors') return { COLORS: {} };
      if (name === '../styles/spacing') return { SPACING: {} };
      if (name === '../styles/components') return { BUTTON_PRIMARY: {}, BUTTON_TEXT: {} };
      throw new Error(name);
    }
  }, { filename: sourcePath });
  const tree = exports.default({ navigation: { replace, navigate: jest.fn() } });
  function findButton(node) {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) return node.map(findButton).find(Boolean);
    if (node.type === 'TouchableOpacity' && node.props.onPress?.constructor.name === 'AsyncFunction') return node;
    return findButton(node.props?.children);
  }
  return { pressLogin: () => findButton(tree).props.onPress(), alert, setItem, replace };
}

describe('Retour de connexion mobile', () => {
  test('conserve le message générique pour des identifiants refusés', async () => {
    const screen = createScreen(jest.fn().mockRejectedValue(new Error('Email ou mot de passe incorrect')));
    await screen.pressLogin();
    expect(screen.alert).toHaveBeenCalledWith('Erreur de connexion', 'Email ou mot de passe incorrect');
    expect(screen.replace).not.toHaveBeenCalled();
  });

  test('explique une panne réseau au lieu d’accuser le mot de passe', async () => {
    const screen = createScreen(jest.fn().mockRejectedValue(new Error('Network request failed')));
    await screen.pressLogin();
    expect(screen.alert).toHaveBeenCalledWith('Erreur de connexion',
      "Impossible de joindre le serveur. Vérifie le réseau et l'adresse de l'API.");
    expect(screen.replace).not.toHaveBeenCalled();
  });

  test('ne masque pas une erreur temporaire du backend', async () => {
    const screen = createScreen(jest.fn().mockRejectedValue(new Error('Service temporairement indisponible')));
    await screen.pressLogin();
    expect(screen.alert).toHaveBeenCalledWith('Erreur de connexion', 'Service temporairement indisponible');
  });

  test('préserve la connexion lorsque la réponse est valide', async () => {
    const screen = createScreen(jest.fn().mockResolvedValue({ token: 'jeton-fictif' }));
    await screen.pressLogin();
    expect(screen.setItem).toHaveBeenCalledWith('token', 'jeton-fictif');
    expect(screen.replace).toHaveBeenCalledWith('Main');
  });
});
