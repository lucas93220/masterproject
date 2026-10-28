/* global jest, describe, test, expect */
const { createScreenHarness, nodes, text, button, flush } = require('./helpers/screenHarness');
const clothing = { id_vetement: 7, nom: 'Chemise', marque: 'Test', couleur: 'blanc', favori: true,
  photo: '/uploads/fixture.jpg', temperature_min: 0, temperature_max: 30,
  id_sous_categorie: 4, sous_categorie: { nom_sous_categorie: 'Chemises' } };
function mount(editing = clothing, overrides = {}) {
  const api = { addClothing: jest.fn().mockResolvedValue({}), updateClothing: jest.fn().mockResolvedValue({}),
    analyzeClothingImage: jest.fn().mockResolvedValue({ nom: 'Pull noir', marque: 'Nike', couleur: 'noir',
      id_sous_categorie: 3, nom_sous_categorie: 'Pulls' }),
    deleteClothing: jest.fn().mockResolvedValue({}), uploadImage: jest.fn().mockResolvedValue('/uploads/new.jpg'),
    getCategories: jest.fn().mockResolvedValue([{ id_categorie: 2, nom_categorie: 'Vêtements' }]),
    getSousCategoriesByCategorie: jest.fn().mockResolvedValue([{ id_sous_categorie: 4, nom_sous_categorie: 'Chemises' }]), ...overrides };
  const imagePicker = { launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///fixture.png', mimeType: 'image/png' }] }) };
  const navigation = { goBack: jest.fn() };
  const screen = createScreenHarness('addClothing', api, { navigation, imagePicker, route: { params: { clothing: editing } } });
  screen.render(); const cleanups = screen.effects.map(effect => effect());
  return { screen, api, navigation, imagePicker, cleanups };
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
  test('crée un vêtement avec une estimation thermique issue de la catégorie', async () => {
    const { screen, api } = mount(null);
    field(screen, 'Nom du vêtement *').props.onChangeText('Pull');
    button(screen.render(), 'Couleur bleu').props.onPress();
    button(screen.render(), 'Choisir une catégorie').props.onPress(); await flush();
    button(screen.render(), 'Vêtements').props.onPress(); await flush();
    button(screen.render(), 'Chemises').props.onPress();
    await button(screen.render(), 'Ajouter à mon dressing').props.onPress();
    expect(api.addClothing).toHaveBeenCalledWith(expect.objectContaining({ nom: 'Pull', couleur: 'bleu',
      temperature_min: -20, temperature_max: 28, id_sous_categorie: 4, photo: null, favori: false }));
  });
  test.each([['50', '5'], ['abc', '30'], ['0', 'Infinity']])('refuse les températures invalides %s / %s', async (min, max) => {
    const { screen, api } = mount();
    button(screen.render(), 'Ajuster les températures').props.onPress();
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
    button(screen.render(), 'Ajuster les températures').props.onPress();
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


test('les températures sont facultatives à la saisie et la modification conserve les anciennes valeurs', async () => {
  const { screen, api } = mount();
  expect(field(screen, 'Minimum · °C')).toBeUndefined();
  await button(screen.render(), 'Enregistrer les modifications').props.onPress();
  expect(api.updateClothing.mock.calls[0][1]).toMatchObject({ temperature_min: 0, temperature_max: 30 });
});

test('remplace les valeurs existantes par l’estimation seulement sur demande explicite', async () => {
  const { screen, api } = mount();
  button(screen.render(), 'Utiliser l’estimation automatique').props.onPress();
  expect(text(screen.render())).toContain('Estimation automatique');
  await button(screen.render(), 'Enregistrer les modifications').props.onPress();
  expect(api.updateClothing.mock.calls[0][1]).toMatchObject({ temperature_min: -20, temperature_max: 28 });
});

test('un ajustement manuel reste prioritaire après changement de catégorie', async () => {
  const { screen, api } = mount();
  button(screen.render(), 'Ajuster les températures').props.onPress();
  field(screen, 'Minimum · °C').props.onChangeText('5');
  field(screen, 'Maximum · °C').props.onChangeText('19');
  button(screen.render(), 'Choisir une catégorie').props.onPress(); await flush();
  button(screen.render(), 'Choisir Vêtements').props.onPress(); await flush();
  button(screen.render(), 'Choisir Chemises').props.onPress();
  await button(screen.render(), 'Enregistrer les modifications').props.onPress();
  expect(api.updateClothing.mock.calls[0][1]).toMatchObject({ temperature_min: 5, temperature_max: 19 });
});

test('le mode automatique suit la sous-catégorie sans utiliser le nom libre du vêtement', async () => {
  const { screen, api } = mount(null, { getSousCategoriesByCategorie: jest.fn().mockResolvedValue([
    { id_sous_categorie: 10, nom_sous_categorie: 'T-shirts et débardeurs' },
    { id_sous_categorie: 11, nom_sous_categorie: 'Manteaux et doudounes' }
  ]) });
  field(screen, 'Nom du vêtement *').props.onChangeText('Ma pièce');
  button(screen.render(), 'Couleur noir').props.onPress();
  async function select(label) {
    button(screen.render(), 'Choisir une catégorie').props.onPress(); await flush();
    button(screen.render(), 'Choisir Vêtements').props.onPress(); await flush();
    button(screen.render(), label).props.onPress();
  }
  await select('Choisir T-shirts et débardeurs');
  expect(text(screen.render())).toContain('Haut de base, seul ou sous une autre couche');
  await select('Choisir Manteaux et doudounes');
  expect(text(screen.render())).toContain('Vêtement d’extérieur chaud');
  await button(screen.render(), 'Ajouter à mon dressing').props.onPress();
  expect(api.addClothing.mock.calls[0][0]).toMatchObject({ temperature_min: -20, temperature_max: 12, id_sous_categorie: 11 });
});

test('une catégorie inconnue est signalée et reste ajustable manuellement', async () => {
  const { screen, api } = mount({ ...clothing, sous_categorie: { nom_sous_categorie: 'Autre pièce' } });
  button(screen.render(), 'Utiliser l’estimation automatique').props.onPress();
  expect(text(screen.render())).toContain('l’estimation est large');
  button(screen.render(), 'Ajuster les températures').props.onPress();
  expect(field(screen, 'Minimum · °C').props.value).toBe('-20');
  field(screen, 'Minimum · °C').props.onChangeText('10');
  field(screen, 'Maximum · °C').props.onChangeText('25');
  await button(screen.render(), 'Enregistrer les modifications').props.onPress();
  expect(api.updateClothing.mock.calls[0][1]).toMatchObject({ temperature_min: 10, temperature_max: 25 });
});

describe('Préremplissage photo', () => {
  test('attend un appui explicite puis préremplit sans enregistrer le vêtement', async () => {
    const { screen, api } = mount(null);
    await button(screen.render(), 'Ajouter une photo').props.onPress();
    expect(api.analyzeClothingImage).not.toHaveBeenCalled();
    expect(api.uploadImage).not.toHaveBeenCalled();
    expect(text(screen.render())).toContain('Google Gemini');
    await button(screen.render(), 'Préremplir avec la photo').props.onPress();
    expect(api.analyzeClothingImage).toHaveBeenCalledWith('file:///fixture.png', 'image/png');
    expect(field(screen, 'Nom du vêtement *').props.value).toBe('Pull noir');
    expect(field(screen, 'Marque').props.value).toBe('Nike');
    expect(text(screen.render())).toContain('Pulls');
    expect(api.addClothing).not.toHaveBeenCalled();
    await button(screen.render(), 'Ajouter à mon dressing').props.onPress();
    expect(api.addClothing).toHaveBeenCalledWith(expect.objectContaining({ nom: 'Pull noir', marque: 'Nike',
      couleur: 'noir', id_sous_categorie: 3, temperature_min: -20, temperature_max: 20 }));
  });
  test('laisse une marque incertaine vide et exige une catégorie manuelle si elle est inconnue', async () => {
    const { screen, api } = mount(null, { analyzeClothingImage: jest.fn().mockResolvedValue({
      nom: 'Pull', marque: null, couleur: 'inconnue', id_sous_categorie: null }) });
    await button(screen.render(), 'Ajouter une photo').props.onPress();
    await button(screen.render(), 'Préremplir avec la photo').props.onPress();
    expect(field(screen, 'Marque').props.value).toBe('');
    await button(screen.render(), 'Ajouter à mon dressing').props.onPress();
    expect(api.addClothing).not.toHaveBeenCalled();
    expect(text(screen.render())).toContain('choisis une catégorie');
  });
  test('conserve les corrections manuelles avant et après une reconnaissance', async () => {
    const { screen, api } = mount(null);
    field(screen, 'Nom du vêtement *').props.onChangeText('Mon pull préféré');
    button(screen.render(), 'Couleur bleu').props.onPress();
    await button(screen.render(), 'Ajouter une photo').props.onPress();
    await button(screen.render(), 'Préremplir avec la photo').props.onPress();
    field(screen, 'Marque').props.onChangeText('Autre marque');
    await button(screen.render(), 'Préremplir avec la photo').props.onPress();
    await button(screen.render(), 'Ajouter à mon dressing').props.onPress();
    expect(api.addClothing).toHaveBeenCalledWith(expect.objectContaining({ nom: 'Mon pull préféré',
      marque: 'Autre marque', couleur: 'bleu' }));
  });
  test('ne remplace pas les valeurs d’une fiche existante ni ses températures', async () => {
    const { screen, api } = mount();
    await button(screen.render(), 'Changer la photo du vêtement').props.onPress();
    await button(screen.render(), 'Préremplir avec la photo').props.onPress();
    await button(screen.render(), 'Enregistrer les modifications').props.onPress();
    expect(api.updateClothing).toHaveBeenCalledWith(7, expect.objectContaining({
      nom: 'Chemise', marque: 'Test', couleur: 'blanc', id_sous_categorie: 4,
      temperature_min: 0, temperature_max: 30
    }));
  });
  test('bloque les analyses et sauvegardes simultanées', async () => {
    let resolve;
    const { screen, api } = mount(null, { analyzeClothingImage: jest.fn(() => new Promise(done => { resolve = done; })) });
    await button(screen.render(), 'Ajouter une photo').props.onPress();
    const analyze = button(screen.render(), 'Préremplir avec la photo');
    const pending = analyze.props.onPress();
    await analyze.props.onPress();
    expect(button(screen.render(), 'Analyse de la photo…').props.disabled).toBe(true);
    await button(screen.render(), 'Ajouter à mon dressing').props.onPress();
    expect(api.addClothing).not.toHaveBeenCalled();
    expect(api.analyzeClothingImage).toHaveBeenCalledTimes(1);
    resolve({ nom: 'Pull' }); await pending;
    expect(button(screen.render(), 'Préremplir avec la photo').props.disabled).toBe(false);
  });
  test('signale la panne et permet de poursuivre avec les valeurs manuelles', async () => {
    const { screen, api } = mount(clothing, { analyzeClothingImage: jest.fn().mockRejectedValue(new Error('Service indisponible')) });
    await button(screen.render(), 'Changer la photo du vêtement').props.onPress();
    await button(screen.render(), 'Préremplir avec la photo').props.onPress();
    expect(text(screen.render())).toContain('Service indisponible');
    await button(screen.render(), 'Enregistrer les modifications').props.onPress();
    expect(api.updateClothing).toHaveBeenCalledTimes(1);
  });
  test('changer de photo efface les anciennes propositions mais conserve les champs saisis', async () => {
    const { screen, imagePicker } = mount(null);
    await button(screen.render(), 'Ajouter une photo').props.onPress();
    await button(screen.render(), 'Préremplir avec la photo').props.onPress();
    field(screen, 'Nom du vêtement *').props.onChangeText('Mon nom');
    imagePicker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: false,
      assets: [{ uri: 'file:///autre.png', mimeType: 'image/png' }] });
    await button(screen.render(), 'Changer la photo du vêtement').props.onPress();
    expect(field(screen, 'Nom du vêtement *').props.value).toBe('Mon nom');
    expect(field(screen, 'Marque').props.value).toBe('');
    expect(text(screen.render())).not.toContain('Pulls');
  });
  test('ignore une réponse d’analyse après fermeture de l’écran', async () => {
    let resolve;
    const { screen, cleanups } = mount(null, { analyzeClothingImage: jest.fn(() => new Promise(done => { resolve = done; })) });
    await button(screen.render(), 'Ajouter une photo').props.onPress();
    const pending = button(screen.render(), 'Préremplir avec la photo').props.onPress();
    cleanups.forEach(cleanup => cleanup?.());
    resolve({ nom: 'Réponse périmée' }); await pending;
    expect(field(screen, 'Nom du vêtement *').props.value).toBe('');
  });
});
