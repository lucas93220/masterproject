/* global __dirname, jest */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../../node_modules/typescript');

// Les vrais composants de présentation sont rendus ; seuls les adaptateurs natifs,
// les hooks et les appels réseau sont simulés. Aucun serveur ni stockage réel.
function createScreenHarness(name, api, { navigation = {}, route = {}, platform = 'ios', storage = {}, browser = {}, imagePicker = {} } = {}) {
  const hooks = [], effects = [], cache = {};
  let cursor = 0;
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial;
      return [hooks[i], value => { hooks[i] = typeof value === 'function' ? value(hooks[i]) : value; }];
    },
    useRef(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = { current: initial }; return hooks[i]; },
    useEffect(callback) { const i = cursor++; if (!(i in hooks)) { hooks[i] = true; effects.push(callback); } }
  };
  const alert = jest.fn();
  const native = new Proxy({ Alert: { alert }, Platform: { OS: platform } }, {
    get: (target, key) => target[key] || key
  });
  const element = (type, props) => {
    if (typeof type === 'function') return type(props);
    if (type === 'Modal' && !props.visible) return null;
    if (type === 'FlatList') return { type, props: { ...props, children: [props.ListHeaderComponent,
      props.data?.length ? props.data.map(item => props.renderItem({ item })) : props.ListEmptyComponent] } };
    return { type, props };
  };
  function load(file) {
    if (cache[file]) return cache[file];
    const exports = {};
    cache[file] = exports;
    const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      fileName: file + 'x', compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true
    });
    if (compiled.diagnostics.length) throw new Error(`Compilation impossible : ${file}`);
    vm.runInNewContext(compiled.outputText, { exports, alert: browser.alert, confirm: browser.confirm,
      require: id => {
        if (id === 'react') return react;
        if (id === 'react/jsx-runtime') return { jsx: element, jsxs: element, Fragment: 'Fragment' };
        if (id === 'react-native') return native;
        if (id === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView' };
        if (id === '@expo/vector-icons') return { Ionicons: 'Ionicons' };
        if (id === '@react-native-async-storage/async-storage') return { default: storage };
        if (id === 'expo-image-picker') return imagePicker;
        if (id.endsWith('/services/api')) return api;
        if (id.endsWith('/ClothingImage')) return { default: 'ClothingImage' };
        if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id + '.js'));
        throw new Error('Dépendance non simulée : ' + id);
      }
    }, { filename: file });
    return exports;
  }
  const Screen = load(path.join(__dirname, '../../src/screens', name + '.js')).default;
  return { alert, effects, render: () => { cursor = 0; return Screen({ navigation, route }); } };
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join('');
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  return tree && typeof tree === 'object' ? text(tree.props?.children) : '';
}
function button(tree, label) {
  return nodes(tree).find(node => node.type === 'TouchableOpacity' && (node.props.accessibilityLabel === label || text(node) === label));
}
const flush = () => new Promise(resolve => setImmediate(resolve));
module.exports = { createScreenHarness, nodes, text, button, flush };
