/* global jest, describe, test, expect */
const { createScreenHarness, nodes, text, button, flush } = require('./helpers/screenHarness');
const clothing = { id_vetement: 7, nom: 'Chemise', marque: 'Test', couleur: 'blanc', favori: true,
  photo: '/uploads/fixture.jpg', temperature_min: 0, temperature_max: 30,
  id_sous_categorie: 4, sous_categorie: { nom_sous_categorie: 'Chemises' } };
function mount(editing = clothing, overrides = {}) {
  const api = { addClothing: jest.fn().mockResolvedValue({}), updateClothing: jest.fn().mockResolvedValue({}),
    deleteClothing: jest.fn().mockResolvedValue({}), uploadImage: jest.fn().mockResolvedValue('/uploads/new.jpg'),
    getCategories: jest.fn().mockResolvedValue([{ id_categorie: 2, nom_categorie: 'Vêtements' }]),
    getSousCategoriesByCategorie: jest.fn().mockResolvedValue([{ id_sous_categorie: 4, nom_sous_categorie: 'Chemises' }]), ...overrides };
  const imagePicker = { launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///fixture.png', mimeType: 'image/png' }] }) };
  const navigation = { goBack: jest.fn() };
  const screen = createScreenHarness('addClothing', api, { navigation, imagePicker, route: { params: { clothing: editing } } });
  screen.render(); screen.effects.forEach(effect => effect());
  return { screen, api, navigation, imagePicker };
}
const field = (screen, label) => nodes(screen.render()).find(node => node.type === 'TextInput' && node.props.accessibilityLabel === label);

describe('Formulaire vêtement : contrats et protections', () => {
  test('la modification préremplit la catégorie et conserve photo, favoris, couleur et températures', async () => {
    const { screen, api, navigation } = mount();
    expect(text(screen.render())).toContain('Chemises');
    await button(screen.render(), 'Enregistrer les modifications').props.onPress();
    expect(api.updateClothing).toHaveBeenCalledWith(7, {
      nom: 'Chemise', marque: 'Test', couleur: 'blanc', photo: '/uploads/fixture.jpg', favori: true,
      temperature_min: 0, temperature_max: 30, id_sous_categorie: 4
    });
    expect(api.uploadImage).not.toHaveBeenCalled(); expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
  test('crée un vêtement après sélection de catégorie et couleur, sans changer les valeurs par défaut', async () => {
    const { screen, api } = mount(null);
    field(screen, 'Nom du vêtement *').props.onChangeText('Pull');
    button(screen.render(), 'Couleur bleu').props.onPress();
    button(screen.render(), 'Choisir une catégorie').props.onPress(); await flush();
    button(screen.render(), 'Vêtements').props.onPress(); await flush();
    button(screen.render(), 'Chemises').props.onPress();
    await button(screen.render(), 'Ajouter à mon dressing').props.onPress();
    expect(api.addClothing).toHaveBeenCalledWith(expect.objectContaining({ nom: 'Pull', couleur: 'bleu',
      temperature_min: 0, temperature_max: 50, id_sous_categorie: 4, photo: null, favori: false }));
  });
  test.each([['50', '5'], ['abc', '30'], ['0', 'Infinity']])('refuse les températures invalides %s / %s', async (min, max) => {
    const { screen, api } = mount();
    field(screen, 'Minimum · °C').props.onChangeText(min); field(screen, 'Maximum · °C').props.onChangeText(max);
    await button(screen.render(), 'Enregistrer les modifications').props.onPress();
    expect(api.updateClothing).not.toHaveBeenCalled(); expect(text(screen.render())).toContain('températures valides');
  });
  test('refuse nom vide, catégorie absente et couleur inconnue', async () => {
    for (const value of [{ ...clothing, nom: '  ' }, { ...clothing, id_sous_categorie: null }, { ...clothing, couleur: 'inconnue' }]) {
      const { screen, api } = mount(value);
      await button(screen.render(), 'Enregistrer les modifications').props.onPress();
      expect(api.updateClothing).not.toHaveBeenCalled();
    }
  });
  test('accepte température négative et virgule décimale', async () => {
    const { screen, api } = mount();
    field(screen, 'Minimum · °C').props.onChangeText('-5,5');
    await button(screen.render(), 'Enregistrer les modifications').props.onPress();
    expect(api.updateClothing.mock.calls[0][1].temperature_min).toBe(-5.5);
  });
  test('bloque le double envoi puis réessaie sans téléverser deux fois une même photo', async () => {
    let reject;
    const { screen, api } = mount(clothing, { updateClothing: jest.fn().mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; })).mockResolvedValue({}) });
    await button(screen.render(), 'Changer la photo du vêtement').props.onPress();
    const save = button(screen.render(), 'Enregistrer les modifications');
    const pending = save.props.onPress(); await flush(); await save.props.onPress();
    expect(api.updateClothing).toHaveBeenCalledTimes(1);
    expect(api.uploadImage).toHaveBeenCalledWith('file:///fixture.png', 'image/png');
    reject(new Error('Réseau indisponible')); await pending;
    expect(text(screen.render())).toContain('Réseau indisponible');
    await button(screen.render(), 'Enregistrer les modifications').props.onPress();
    expect(api.uploadImage).toHaveBeenCalledTimes(1); expect(api.updateClothing).toHaveBeenCalledTimes(2);
  });
  test('la fermeture du catalogue ignore une réponse tardive', async () => {
    let resolve;
    const { screen } = mount(null, { getCategories: jest.fn().mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValue([]) });
    button(screen.render(), 'Choisir une catégorie').props.onPress();
    button(screen.render(), 'Fermer').props.onPress();
    resolve([{ id_categorie: 99, nom_categorie: 'Réponse périmée' }]); await flush();
    button(screen.render(), 'Choisir une catégorie').props.onPress(); await flush();
    expect(text(screen.render())).not.toContain('Réponse périmée');
  });
  test('retire explicitement une pièce seulement après confirmation', async () => {
    const { screen, api, navigation } = mount();
    button(screen.render(), 'Retirer du dressing').props.onPress();
    expect(api.deleteClothing).not.toHaveBeenCalled();
    await screen.alert.mock.calls[0][2][1].onPress();
    expect(api.deleteClothing).toHaveBeenCalledWith(7); expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
});
