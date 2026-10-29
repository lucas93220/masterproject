/* global __dirname, jest, describe, beforeEach, test, expect */

const { createScreenHarness } = require("./helpers/screenHarness");
const createScreen = api => createScreenHarness("home", api);

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

    expect(api.generateTenue).toHaveBeenCalledWith(18, "01d");
    expect(api.evaluateTenue).not.toHaveBeenCalled();
    expect(nodes(screen.render()).some(node => node.props?.accessibilityLabel === "Voir Pull fictif")).toBe(true);
    expect(buttons(screen.render()).like).toBeDefined();
  });
  test('le raccourci vers l’ajout conserve la liste du dressing comme écran de retour', async () => {
    const navigation = { navigate: jest.fn() };
    screen = createScreenHarness('home', api, { navigation });
    await mount();
    const complete = nodes(screen.render()).find(node => node.type === 'TouchableOpacity' &&
      node.props.accessibilityLabel === 'Compléter mon dressing');
    complete.props.onPress();
    expect(navigation.navigate).toHaveBeenCalledWith('Dressing', { screen: 'AddClothing', initial: false });
  });

  test("enregistre un like et conserve la tenue sans régénération", async () => {
    const current = await showTenue();
    await current.like.props.onPress();

    expect(api.evaluateTenue).toHaveBeenCalledTimes(1);
    expect(api.evaluateTenue).toHaveBeenCalledWith(10, true);
    expect(api.generateTenue).not.toHaveBeenCalled();
    expect(nodes(screen.render()).some(node => node.props?.accessibilityLabel === "Voir Pull fictif")).toBe(true);
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
    expect(api.generateTenue).toHaveBeenCalledWith(18, "01d");
    expect(buttons(screen.render()).generate.props.disabled).toBe(true);
    generation.resolve(nextTenue);
    await pending;

    expect(nodes(screen.render()).some(node => node.props?.accessibilityLabel === "Voir Chemise fictive")).toBe(true);
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
    expect(nodes(screen.render()).some(node => node.props?.accessibilityLabel === "Voir Pull fictif")).toBe(true);

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
    expect(nodes(screen.render()).some(node => node.props?.accessibilityLabel === "Voir Chemise fictive")).toBe(true);
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

test('propose une reprise météo sans générer ni enregistrer d’avis', async () => {
  const { button } = require('./helpers/screenHarness');
  const api = { getWeatherForMe: jest.fn().mockRejectedValueOnce(new Error('Hors ligne')).mockResolvedValue({ temperature: 9, icon: '04d' }),
    generateTenue: jest.fn(), evaluateTenue: jest.fn() };
  const screen = createScreen(api);
  screen.render(); screen.effects.forEach(effect => effect()); await flush();
  expect(text(screen.render())).toContain('Hors ligne');
  await button(screen.render(), 'Réessayer').props.onPress();
  expect(button(screen.render(), 'Générer ma tenue')).toBeDefined();
  expect(api.generateTenue).not.toHaveBeenCalled(); expect(api.evaluateTenue).not.toHaveBeenCalled();
});

describe('Actualisation météo au retour sur l’accueil', () => {
  test('rafraîchit la ville et retire la tenue du contexte précédent', async () => {
    let focus;
    const api = { getWeatherForMe: jest.fn().mockResolvedValueOnce({ ville: 'Paris', temperature: 9, icon: '04d' })
      .mockResolvedValue({ ville: 'Nice', temperature: 24, icon: '01d' }),
      generateTenue: jest.fn().mockResolvedValue(initialTenue), evaluateTenue: jest.fn(), resolveImageUrl: uri => uri };
    const navigation = { addListener: jest.fn((event, callback) => { focus = callback; return jest.fn(); }) };
    const screen = createScreenHarness('home', api, { navigation });
    screen.render(); screen.effects.forEach(effect => effect()); await flush();
    await buttons(screen.render()).generate.props.onPress();
    await focus();
    expect(api.getWeatherForMe).toHaveBeenCalledTimes(2);
    expect(text(screen.render())).toContain('Nice');
    expect(buttons(screen.render()).like).toBeUndefined();
    await buttons(screen.render()).generate.props.onPress();
    expect(api.generateTenue).toHaveBeenLastCalledWith(24, '01d');
  });
  test('ignore une génération terminée après le changement météo', async () => {
    let focus;
    const pending = deferred();
    const api = { getWeatherForMe: jest.fn().mockResolvedValueOnce({ temperature: 9 }).mockResolvedValue({ temperature: 24 }),
      generateTenue: jest.fn(() => pending.promise), resolveImageUrl: uri => uri };
    const screen = createScreenHarness('home', api, { navigation: { addListener: (event, cb) => { focus = cb; return () => {}; } } });
    screen.render(); screen.effects.forEach(effect => effect()); await flush();
    const generation = buttons(screen.render()).generate.props.onPress();
    await focus(); pending.resolve(initialTenue); await generation;
    expect(buttons(screen.render()).like).toBeUndefined();
  });
  test('ignore une réponse météo dépassée et les réponses après démontage', async () => {
    let focus;
    const old = deferred();
    const api = { getWeatherForMe: jest.fn().mockReturnValueOnce(old.promise).mockResolvedValue({ ville: 'Nice', temperature: 24 }) };
    const screen = createScreenHarness('home', api, { navigation: { addListener: (event, cb) => { focus = cb; return () => {}; } } });
    screen.render(); const cleanups = screen.effects.map(effect => effect());
    await focus(); old.resolve({ ville: 'Paris', temperature: 9 }); await flush();
    expect(text(screen.render())).toContain('Nice');
    const late = deferred(); api.getWeatherForMe.mockReturnValueOnce(late.promise);
    const refreshing = focus(); cleanups.forEach(cleanup => cleanup?.());
    late.resolve({ ville: 'Lyon', temperature: 10 }); await refreshing;
    expect(text(screen.render())).not.toContain('Lyon');
  });
});
