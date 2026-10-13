/* global __dirname, jest, describe, beforeEach, test, expect */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("../node_modules/typescript");

// Exécuter le vrai composant avec des hooks et composants natifs simulés.
// TypeScript est déjà installé : aucune dépendance de rendu ou connexion réelle.
const sourcePath = path.join(__dirname, "../src/screens/home.js");
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
  fileName: "home.jsx",
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2020
  },
  reportDiagnostics: true
});
if (compiled.diagnostics.length) {
  throw new Error(ts.formatDiagnosticsWithColorAndContext(compiled.diagnostics, {
    getCanonicalFileName: name => name,
    getCurrentDirectory: () => __dirname,
    getNewLine: () => "\n"
  }));
}

function createScreen(api) {
  const hooks = [];
  const effects = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], value => {
        hooks[index] = typeof value === "function" ? value(hooks[index]) : value;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = { current: initial };
      return hooks[index];
    },
    useEffect(callback) {
      const index = cursor++;
      if (!(index in hooks)) {
        hooks[index] = true;
        effects.push(callback);
      }
    }
  };
  const alert = jest.fn();
  const native = { Alert: { alert } };
  for (const name of ["View", "Text", "ActivityIndicator", "Image", "ScrollView", "TouchableOpacity", "SafeAreaView"]) {
    native[name] = name;
  }
  const element = (type, props) => ({ type, props });
  const dependencies = {
    react,
    "react/jsx-runtime": { jsx: element, jsxs: element },
    "react-native": native,
    "@expo/vector-icons": { Ionicons: "Ionicons" },
    "../services/api": api,
    "../styles/colors": { COLORS: {} },
    "../styles/spacing": { SPACING: {} },
    "../styles/components": { CARD: {}, BUTTON_PRIMARY: {}, BUTTON_TEXT: {} }
  };
  const exports = {};
  vm.runInNewContext(compiled.outputText, {
    exports,
    require: name => {
      if (!(name in dependencies)) throw new Error("Dépendance non simulée : " + name);
      return dependencies[name];
    }
  }, { filename: sourcePath });

  return {
    alert,
    effects,
    render() {
      cursor = 0;
      return exports.default();
    }
  };
}

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
}

function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (typeof tree === "string") return tree;
  return tree && typeof tree === "object" ? text(tree.props?.children) : "";
}

function buttons(tree) {
  const touchables = nodes(tree).filter(node => node.type === "TouchableOpacity");
  const iconButton = name => touchables.find(node =>
    nodes(node).some(child => child.type === "Ionicons" && child.props.name === name)
  );
  return {
    like: iconButton("heart"),
    dislike: iconButton("close"),
    generate: touchables.find(node => /Générer ma tenue|Génération\.\.\./.test(text(node)))
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((finish, fail) => { resolve = finish; reject = fail; });
  return { promise, resolve, reject };
}

const flush = () => new Promise(resolve => setImmediate(resolve));
const initialTenue = { id_tenue: 10, vetements: [{ id_vetement: 1, nom: "Pull fictif" }] };
const nextTenue = { id_tenue: 20, vetements: [{ id_vetement: 2, nom: "Chemise fictive" }] };

describe("Évaluation sur l'écran d'accueil (API et hooks simulés)", () => {
  let api;
  let screen;

  beforeEach(() => {
    api = {
      getWeatherForMe: jest.fn().mockResolvedValue({ temperature: 18, icon: "01d" }),
      generateTenue: jest.fn().mockResolvedValue(initialTenue),
      evaluateTenue: jest.fn().mockResolvedValue({}),
      resolveImageUrl: uri => uri
    };
    screen = createScreen(api);
  });

  async function mount() {
    screen.render();
    screen.effects.forEach(callback => callback());
    await flush();
  }

  async function showTenue() {
    await mount();
    await buttons(screen.render()).generate.props.onPress();
    api.generateTenue.mockClear();
    return buttons(screen.render());
  }

  test("conserve le chargement météo et la génération sans enregistrer d'avis", async () => {
    expect(nodes(screen.render()).some(node => node.type === "ActivityIndicator")).toBe(true);
    await mount();
    expect(api.getWeatherForMe).toHaveBeenCalledTimes(1);
    await buttons(screen.render()).generate.props.onPress();

    expect(api.generateTenue).toHaveBeenCalledWith(18);
    expect(api.evaluateTenue).not.toHaveBeenCalled();
    expect(text(screen.render())).toContain("Pull fictif");
    expect(buttons(screen.render()).like).toBeDefined();
  });

  test("enregistre un like et conserve la tenue sans régénération", async () => {
    const current = await showTenue();
    await current.like.props.onPress();

    expect(api.evaluateTenue).toHaveBeenCalledTimes(1);
    expect(api.evaluateTenue).toHaveBeenCalledWith(10, true);
    expect(api.generateTenue).not.toHaveBeenCalled();
    expect(text(screen.render())).toContain("Pull fictif");
    expect(buttons(screen.render()).like).toBeUndefined();
    expect(buttons(screen.render()).dislike).toBeUndefined();
    expect(buttons(screen.render()).generate.props.disabled).toBe(false);
  });

  test("attend l'enregistrement du dislike avant de régénérer et affiche la nouvelle tenue", async () => {
    const current = await showTenue();
    const save = deferred();
    const generation = deferred();
    api.evaluateTenue.mockReturnValueOnce(save.promise);
    api.generateTenue.mockReturnValueOnce(generation.promise);

    const pending = current.dislike.props.onPress();
    expect(api.evaluateTenue).toHaveBeenCalledWith(10, false);
    expect(api.generateTenue).not.toHaveBeenCalled();
    const busy = buttons(screen.render());
    expect(busy.like.props.disabled).toBe(true);
    expect(busy.dislike.props.disabled).toBe(true);
    expect(busy.generate.props.disabled).toBe(true);

    save.resolve({});
    await flush();
    expect(api.generateTenue).toHaveBeenCalledTimes(1);
    expect(api.generateTenue).toHaveBeenCalledWith(18);
    expect(buttons(screen.render()).generate.props.disabled).toBe(true);
    generation.resolve(nextTenue);
    await pending;

    expect(text(screen.render())).toContain("Chemise fictive");
    expect(buttons(screen.render()).like.props.disabled).toBe(false);
    await buttons(screen.render()).like.props.onPress();
    expect(api.evaluateTenue).toHaveBeenLastCalledWith(20, true);
  });

  test.each(["like", "dislike"])("un échec de %s conserve la tenue et permet de réessayer", async action => {
    const current = await showTenue();
    api.evaluateTenue.mockRejectedValueOnce(new Error("Enregistrement indisponible"));
    await current[action].props.onPress();

    expect(api.generateTenue).not.toHaveBeenCalled();
    expect(screen.alert).toHaveBeenCalledWith(
      "Erreur d’évaluation", "Impossible d’enregistrer ton avis : Enregistrement indisponible"
    );
    const retry = buttons(screen.render());
    expect(retry.like.props.disabled).toBe(false);
    expect(retry.dislike.props.disabled).toBe(false);
    expect(retry.generate.props.disabled).toBe(false);
    expect(text(screen.render())).toContain("Pull fictif");

    await retry[action].props.onPress();
    expect(api.evaluateTenue).toHaveBeenCalledTimes(2);
    expect(api.evaluateTenue).toHaveBeenLastCalledWith(10, action === "like");
  });

  test.each(["like", "dislike"])("bloque les clics simultanés pendant un %s, avant même le rendu", async action => {
    const current = await showTenue();
    const save = deferred();
    api.evaluateTenue.mockReturnValueOnce(save.promise);

    const pending = current[action].props.onPress();
    await current.like.props.onPress();
    await current.dislike.props.onPress();
    await current.generate.props.onPress();
    expect(api.evaluateTenue).toHaveBeenCalledTimes(1);
    expect(api.generateTenue).not.toHaveBeenCalled();

    save.resolve({});
    await pending;
    expect(api.generateTenue).toHaveBeenCalledTimes(action === "dislike" ? 1 : 0);
    expect(buttons(screen.render()).generate.props.disabled).toBe(false);
  });

  test("bloque les évaluations et une seconde génération pendant une génération manuelle", async () => {
    const current = await showTenue();
    const generation = deferred();
    api.generateTenue.mockReturnValueOnce(generation.promise);

    const pending = current.generate.props.onPress();
    await current.like.props.onPress();
    await current.dislike.props.onPress();
    await current.generate.props.onPress();
    expect(api.evaluateTenue).not.toHaveBeenCalled();
    expect(api.generateTenue).toHaveBeenCalledTimes(1);
    const busy = buttons(screen.render());
    expect(busy.like.props.disabled).toBe(true);
    expect(busy.dislike.props.disabled).toBe(true);
    expect(busy.generate.props.disabled).toBe(true);

    generation.resolve(nextTenue);
    await pending;
    expect(buttons(screen.render()).like.props.disabled).toBe(false);
  });

  test("garde le verrou pendant la régénération après un dislike", async () => {
    const current = await showTenue();
    const generation = deferred();
    api.generateTenue.mockReturnValueOnce(generation.promise);

    const pending = current.dislike.props.onPress();
    await flush();
    await current.like.props.onPress();
    await current.dislike.props.onPress();
    await current.generate.props.onPress();
    expect(api.evaluateTenue).toHaveBeenCalledTimes(1);
    expect(api.generateTenue).toHaveBeenCalledTimes(1);

    generation.resolve(nextTenue);
    await pending;
  });

  test("distingue l'avis enregistré d'une régénération échouée et permet de relancer", async () => {
    const current = await showTenue();
    api.generateTenue.mockRejectedValueOnce(new Error("ML indisponible"));
    await current.dislike.props.onPress();

    expect(api.evaluateTenue).toHaveBeenCalledTimes(1);
    expect(api.evaluateTenue).toHaveBeenCalledWith(10, false);
    expect(screen.alert).toHaveBeenCalledWith(
      "Erreur génération", "Ton avis a été enregistré, mais la génération a échoué : ML indisponible"
    );
    expect(buttons(screen.render()).like).toBeUndefined();
    expect(buttons(screen.render()).dislike).toBeUndefined();
    expect(buttons(screen.render()).generate.props.disabled).toBe(false);

    api.generateTenue.mockResolvedValueOnce(nextTenue);
    await buttons(screen.render()).generate.props.onPress();
    expect(api.evaluateTenue).toHaveBeenCalledTimes(1);
    expect(text(screen.render())).toContain("Chemise fictive");
  });

  test("conserve les avis disponibles et libère le verrou après une génération manuelle échouée", async () => {
    const current = await showTenue();
    api.generateTenue.mockRejectedValueOnce(new Error("Erreur réseau simulée"));
    await current.generate.props.onPress();

    expect(screen.alert).toHaveBeenCalledWith("Erreur génération", "Erreur réseau simulée");
    const retry = buttons(screen.render());
    expect(retry.like.props.disabled).toBe(false);
    expect(retry.dislike.props.disabled).toBe(false);
    expect(retry.generate.props.disabled).toBe(false);
    await retry.like.props.onPress();
    expect(api.evaluateTenue).toHaveBeenCalledWith(10, true);
  });
});
