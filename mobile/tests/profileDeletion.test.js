/* global __dirname, jest, describe, beforeEach, test, expect */

const { createScreenHarness } = require("./helpers/screenHarness");
const createScreen = (api, storage, navigation, platform = "ios", browser = {}) =>
  createScreenHarness("profile", api, { storage, navigation, platform, browser });

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

function button(tree, label) {
  return nodes(tree).find(node =>
    node.type === "TouchableOpacity" &&
    (node.props.accessibilityLabel === label || text(node).includes(label))
  );
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((finish, fail) => { resolve = finish; reject = fail; });
  return { promise, resolve, reject };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

describe("Suppression du compte depuis le profil (mocks uniquement)", () => {
  let api;
  let storage;
  let navigation;
  let screen;

  beforeEach(async () => {
    api = {
      getProfile: jest.fn().mockResolvedValue({ nom: "Test" }),
      updateProfile: jest.fn(),
      deleteMyAccount: jest.fn()
    };
    storage = { removeItem: jest.fn().mockResolvedValue() };
    const parent = { reset: jest.fn() };
    navigation = { getParent: jest.fn(() => parent) };
    screen = createScreen(api, storage, navigation);
    screen.render();
    screen.effects.forEach(effect => effect());
    await flush();
  });

  test("demande une confirmation et permet d'annuler sans appel API", () => {
    const deleteButton = button(screen.render(), "Supprimer mon compte");
    deleteButton.props.onPress();
    deleteButton.props.onPress();
    expect(screen.alert).toHaveBeenCalledTimes(1);
    const actions = screen.alert.mock.calls[0][2];
    expect(actions[1].style).toBe("destructive");
    expect(api.deleteMyAccount).not.toHaveBeenCalled();

    actions[0].onPress();
    deleteButton.props.onPress();
    expect(screen.alert).toHaveBeenCalledTimes(2);
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  test("supprime une seule fois, bloque les appuis et revient à la connexion", async () => {
    const pending = deferred();
    api.deleteMyAccount.mockReturnValue(pending.promise);
    button(screen.render(), "Supprimer mon compte").props.onPress();
    const confirm = screen.alert.mock.calls[0][2][1].onPress;
    const first = confirm();
    await confirm();
    expect(api.deleteMyAccount).toHaveBeenCalledTimes(1);
    expect(button(screen.render(), "Supprimer mon compte").props.disabled).toBe(true);
    expect(storage.removeItem).not.toHaveBeenCalled();

    pending.resolve({ message: "Compte supprimé ; nettoyage annexe en attente de reprise." });
    await first;
    expect(storage.removeItem).toHaveBeenCalledWith("token");
    expect(navigation.getParent().reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: "Login" }]
    });
    expect(screen.alert).toHaveBeenLastCalledWith(
      "Compte supprimé", "Compte supprimé ; nettoyage annexe en attente de reprise."
    );
  });

  test("une erreur conserve la session et permet de réessayer", async () => {
    api.deleteMyAccount.mockRejectedValueOnce(new Error("Réseau indisponible"));
    button(screen.render(), "Supprimer mon compte").props.onPress();
    await screen.alert.mock.calls[0][2][1].onPress();

    expect(screen.alert).toHaveBeenLastCalledWith(
      "Suppression impossible", "Réseau indisponible"
    );
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(navigation.getParent().reset).not.toHaveBeenCalled();
    expect(button(screen.render(), "Supprimer mon compte").props.disabled).toBe(false);

    button(screen.render(), "Supprimer mon compte").props.onPress();
    expect(screen.alert).toHaveBeenCalledTimes(3);
  });

  test("la déconnexion existante revient toujours à l'écran de connexion", async () => {
    await button(screen.render(), "Déconnexion").props.onPress();
    expect(storage.removeItem).toHaveBeenCalledWith("token");
    expect(navigation.getParent().reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: "Login" }]
    });
    expect(api.deleteMyAccount).not.toHaveBeenCalled();
  });

  test("confirme aussi la suppression dans le navigateur", async () => {
    const browser = {
      confirm: jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(true),
      alert: jest.fn()
    };
    api.deleteMyAccount.mockResolvedValue({ message: "Compte supprimé." });
    const webScreen = createScreen(api, storage, navigation, "web", browser);
    webScreen.render();
    webScreen.effects.forEach(effect => effect());
    await flush();

    button(webScreen.render(), "Supprimer mon compte").props.onPress();
    expect(api.deleteMyAccount).not.toHaveBeenCalled();
    button(webScreen.render(), "Supprimer mon compte").props.onPress();
    await flush();
    expect(api.deleteMyAccount).toHaveBeenCalledTimes(1);
    expect(storage.removeItem).toHaveBeenCalledWith("token");
    expect(browser.alert).toHaveBeenCalledWith("Compte supprimé\nCompte supprimé.");
  });
});
