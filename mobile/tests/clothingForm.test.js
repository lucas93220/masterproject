/* global jest, describe, test, expect */
const { createScreenHarness, nodes, text, button, flush } = require('./helpers/screenHarness');
const clothing = { id_vetement: 7, nom: 'Chemise', marque: 'Test', couleur: 'blanc', favori: true,
  photo: '/uploads/fixture.jpg', temperature_min: 0, temperature_max: 30,
  id_sous_categorie: 4, sous_categorie: { nom_sous_categorie: 'Chemises' } };
function mount(editing = clothing, overrides = {}) {
  const api = { addClothing: jest.fn().mockResolvedValue({}), updateClothing: jest.fn().mockResolvedValue({}),
    getBrandCatalogue: jest.fn().mockResolvedValue({ brands: [
      { name: 'Nike', aliases: [], popular: true },
      { name: "Levi's", aliases: ['Levis'], popular: true },
      { name: 'Sézane', aliases: [] }
    ], personalAvailable: true }),
    analyzeClothingImage: jest.fn().mockResolvedValue({ nom: 'Pull noir', marque: 'Nike', couleur: 'noir',
      id_sous_categorie: 3, nom_sous_categorie: 'Pulls' }),
    deleteClothing: jest.fn().mockResolvedValue({}), uploadImage: jest.fn().mockResolvedValue('/uploads/new.jpg'),
    getCategories: jest.fn().mockResolvedValue([{ id_categorie: 2, nom_categorie: 'Vêtements' }]),
    getSousCategoriesByCategorie: jest.fn().mockResolvedValue([{ id_sous_categorie: 4, nom_sous_categorie: 'Chemises' }]), ...overrides };
  const imagePicker = { launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///fixture.png', mimeType: 'image/png' }] }) };
  const navigation = { goBack: jest.fn(), addListener: jest.fn(() => jest.fn()) };
  const screen = createScreenHarness('addClothing', api, { navigation, imagePicker, route: { params: { clothing: editing } } });
  screen.render(); const cleanups = screen.effects.map(effect => effect());
  return { screen, api, navigation, imagePicker, cleanups };
}
const field = (screen, label) => nodes(screen.render()).find(node => node.type === 'TextInput' && node.props.accessibilityLabel === label);
const selectedBrand = screen => button(screen.render(), 'Choisir une marque').props.accessibilityValue.text;
async function customBrand(screen, name) {
  button(screen.render(), 'Choisir une marque').props.onPress(); await flush();
  field(screen, 'Rechercher une marque').props.onChangeText(name);
  button(screen.render(), `Utiliser « ${name} »`).props.onPress();
}

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
  test('une sauvegarde terminée après avoir quitté le formulaire ne déclenche aucun retour tardif', async () => {
    let resolve;
    const { screen, navigation, cleanups } = mount(clothing, {
      updateClothing: jest.fn(() => new Promise(done => { resolve = done; }))
    });
    const pending = button(screen.render(), 'Enregistrer les modifications').props.onPress();
    cleanups.forEach(cleanup => cleanup?.());
    resolve({}); await pending;
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
  test('un retrait terminé après avoir quitté le formulaire ne change plus la navigation', async () => {
    let resolve;
    const { screen, navigation, cleanups } = mount(clothing, {
      deleteClothing: jest.fn(() => new Promise(done => { resolve = done; }))
    });
    button(screen.render(), 'Retirer du dressing').props.onPress();
    const pending = screen.alert.mock.calls[0][2][1].onPress();
    cleanups.forEach(cleanup => cleanup?.());
    resolve({}); await pending;
    expect(navigation.goBack).not.toHaveBeenCalled();
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
  test('préremplit automatiquement à la sélection sans enregistrer le vêtement', async () => {
    const { screen, api } = mount(null);
    await button(screen.render(), 'Ajouter une photo').props.onPress();
    expect(api.analyzeClothingImage).toHaveBeenCalledTimes(1);
    expect(api.uploadImage).not.toHaveBeenCalled();
    expect(text(screen.render())).toContain('Google Gemini');
    expect(api.analyzeClothingImage).toHaveBeenCalledWith('file:///fixture.png', 'image/png');
    expect(field(screen, 'Nom du vêtement *').props.value).toBe('Pull noir');
    expect(selectedBrand(screen)).toBe('Nike');
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
    expect(selectedBrand(screen)).toBe('Non renseignée');
    await button(screen.render(), 'Ajouter à mon dressing').props.onPress();
    expect(api.addClothing).not.toHaveBeenCalled();
    expect(text(screen.render())).toContain('choisis une catégorie');
  });
  test('conserve les corrections manuelles avant et après une reconnaissance', async () => {
    const { screen, api } = mount(null);
    field(screen, 'Nom du vêtement *').props.onChangeText('Mon pull préféré');
    button(screen.render(), 'Couleur bleu').props.onPress();
    await button(screen.render(), 'Ajouter une photo').props.onPress();
    await customBrand(screen, 'Autre marque');
    await button(screen.render(), 'Changer la photo du vêtement').props.onPress();
    await button(screen.render(), 'Ajouter à mon dressing').props.onPress();
    expect(api.addClothing).toHaveBeenCalledWith(expect.objectContaining({ nom: 'Mon pull préféré',
      marque: 'Autre marque', couleur: 'bleu' }));
  });
  test('ne remplace pas les valeurs d’une fiche existante ni ses températures', async () => {
    const { screen, api } = mount();
    await button(screen.render(), 'Changer la photo du vêtement').props.onPress();
    await button(screen.render(), 'Enregistrer les modifications').props.onPress();
    expect(api.updateClothing).toHaveBeenCalledWith(7, expect.objectContaining({
      nom: 'Chemise', marque: 'Test', couleur: 'blanc', id_sous_categorie: 4,
      temperature_min: 0, temperature_max: 30
    }));
  });
  test('bloque une seconde sélection et la sauvegarde pendant l’analyse automatique', async () => {
    let resolve;
    const { screen, api, imagePicker } = mount(null, { analyzeClothingImage: jest.fn(() => new Promise(done => { resolve = done; })) });
    const pending = button(screen.render(), 'Ajouter une photo').props.onPress(); await flush();
    expect(text(screen.render())).toContain('Préremplissage en cours');
    await button(screen.render(), 'Changer la photo du vêtement').props.onPress();
    await button(screen.render(), 'Ajouter à mon dressing').props.onPress();
    expect(api.addClothing).not.toHaveBeenCalled();
    expect(api.analyzeClothingImage).toHaveBeenCalledTimes(1);
    expect(imagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
    resolve({ nom: 'Pull' }); await pending;
    expect(button(screen.render(), 'Ajouter à mon dressing').props.disabled).toBe(false);
  });
  test('signale la panne et permet de poursuivre avec les valeurs manuelles', async () => {
    const { screen, api } = mount(clothing, { analyzeClothingImage: jest.fn().mockRejectedValue(new Error('Service indisponible')) });
    await button(screen.render(), 'Changer la photo du vêtement').props.onPress();
    expect(text(screen.render())).toContain('Service indisponible');
    await button(screen.render(), 'Enregistrer les modifications').props.onPress();
    expect(api.updateClothing).toHaveBeenCalledTimes(1);
  });
  test('changer de photo efface les anciennes propositions mais conserve les champs saisis', async () => {
    const { screen, api, imagePicker } = mount(null);
    await button(screen.render(), 'Ajouter une photo').props.onPress();
    field(screen, 'Nom du vêtement *').props.onChangeText('Mon nom');
    api.analyzeClothingImage.mockResolvedValueOnce({ nom: 'Autre pièce', marque: null, couleur: null });
    imagePicker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: false,
      assets: [{ uri: 'file:///autre.png', mimeType: 'image/png' }] });
    await button(screen.render(), 'Changer la photo du vêtement').props.onPress();
    expect(field(screen, 'Nom du vêtement *').props.value).toBe('Mon nom');
    expect(selectedBrand(screen)).toBe('Non renseignée');
    expect(text(screen.render())).not.toContain('Pulls');
  });
  test('annuler la photothèque ne déclenche aucune analyse', async () => {
    const { screen, api, imagePicker } = mount(null);
    imagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled:true });
    await button(screen.render(), 'Ajouter une photo').props.onPress();
    expect(api.analyzeClothingImage).not.toHaveBeenCalled();
    expect(api.uploadImage).not.toHaveBeenCalled();
  });
  test('une panne ne se relance pas seule ; le bouton de réessai réutilise la photo', async () => {
    const { screen, api, imagePicker } = mount(null, { analyzeClothingImage: jest.fn()
      .mockRejectedValueOnce(new Error('Service indisponible')).mockResolvedValue({ nom:'Pull', couleur:'noir' }) });
    await button(screen.render(), 'Ajouter une photo').props.onPress(); await flush();
    expect(api.analyzeClothingImage).toHaveBeenCalledTimes(1);
    await button(screen.render(), 'Réessayer l’analyse').props.onPress();
    expect(api.analyzeClothingImage).toHaveBeenCalledTimes(2);
    expect(imagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
    expect(field(screen, 'Nom du vêtement *').props.value).toBe('Pull');
    expect(api.addClothing).not.toHaveBeenCalled();
  });
  test('fermer la fiche avant le retour de la photothèque empêche l’envoi', async () => {
    let resolvePicker;
    const { screen, api, imagePicker, cleanups } = mount(null);
    imagePicker.launchImageLibraryAsync.mockImplementation(() => new Promise(resolve => { resolvePicker = resolve; }));
    const pending = button(screen.render(), 'Ajouter une photo').props.onPress();
    cleanups.forEach(cleanup => cleanup?.());
    resolvePicker({ canceled:false, assets:[{ uri:'file:///retour-tardif.jpg', mimeType:'image/jpeg' }] });
    await pending;
    expect(api.analyzeClothingImage).not.toHaveBeenCalled();
  });
  test('ignore une réponse d’analyse après fermeture de l’écran', async () => {
    let resolve;
    const { screen, cleanups } = mount(null, { analyzeClothingImage: jest.fn(() => new Promise(done => { resolve = done; })) });
    const pending = button(screen.render(), 'Ajouter une photo').props.onPress(); await flush();
    cleanups.forEach(cleanup => cleanup?.());
    resolve({ nom: 'Réponse périmée' }); await pending;
    expect(field(screen, 'Nom du vêtement *').props.value).toBe('');
  });

});

describe('Catalogue de marques', () => {
  test('sélectionne une marque canonique et recherche localement sans requête à chaque lettre', async () => {
    const { screen, api } = mount();
    expect(api.getBrandCatalogue).not.toHaveBeenCalled();
    button(screen.render(), 'Choisir une marque').props.onPress(); await flush();
    expect(button(screen.render(), 'Sélectionner la marque Nike')).toBeDefined();
    field(screen, 'Rechercher une marque').props.onChangeText('lEViS');
    expect(button(screen.render(), "Sélectionner la marque Levi's")).toBeDefined();
    expect(button(screen.render(), 'Sélectionner la marque Nike')).toBeUndefined();
    expect(button(screen.render(), 'Utiliser « lEViS »')).toBeUndefined();
    field(screen, 'Rechercher une marque').props.onChangeText('sezane');
    expect(button(screen.render(), 'Sélectionner la marque Sézane')).toBeDefined();
    field(screen, 'Rechercher une marque').props.onChangeText('levis');
    button(screen.render(), "Sélectionner la marque Levi's").props.onPress();
    expect(selectedBrand(screen)).toBe("Levi's");
    button(screen.render(), 'Choisir une marque').props.onPress(); await flush();
    expect(api.getBrandCatalogue).toHaveBeenCalledTimes(1);
    button(screen.render(), 'Fermer').props.onPress();
    await button(screen.render(), 'Enregistrer les modifications').props.onPress();
    expect(api.updateClothing.mock.calls[0][1].marque).toBe("Levi's");
  });
  test('une marque absente est utilisée uniquement après choix explicite et sauvegarde', async () => {
    const { screen, api } = mount();
    button(screen.render(), 'Choisir une marque').props.onPress(); await flush();
    field(screen, 'Rechercher une marque').props.onChangeText('Mon atelier');
    expect(selectedBrand(screen)).toBe('Test');
    expect(api.updateClothing).not.toHaveBeenCalled();
    button(screen.render(), 'Utiliser « Mon atelier »').props.onPress();
    expect(selectedBrand(screen)).toBe('Mon atelier');
    expect(api.updateClothing).not.toHaveBeenCalled();
    await button(screen.render(), 'Enregistrer les modifications').props.onPress();
    expect(api.updateClothing.mock.calls[0][1].marque).toBe('Mon atelier');
  });
  test('Sans marque efface la marque et reste prioritaire sur la reconnaissance photo', async () => {
    const { screen, api } = mount();
    button(screen.render(), 'Choisir une marque').props.onPress(); await flush();
    button(screen.render(), 'Sans marque').props.onPress();
    expect(selectedBrand(screen)).toBe('Sans marque');
    await button(screen.render(), 'Changer la photo du vêtement').props.onPress();
    expect(selectedBrand(screen)).toBe('Sans marque');
    await button(screen.render(), 'Enregistrer les modifications').props.onPress();
    expect(api.updateClothing.mock.calls[0][1].marque).toBe('');
  });
  test('conserve et sélectionne une marque historique ou reconnue absente du catalogue', async () => {
    const { screen, api } = mount(null, { analyzeClothingImage: jest.fn().mockResolvedValue({ marque: 'Atelier photo' }) });
    await button(screen.render(), 'Ajouter une photo').props.onPress();
    button(screen.render(), 'Choisir une marque').props.onPress(); await flush();
    const current = button(screen.render(), 'Sélectionner la marque Atelier photo');
    expect(current.props.accessibilityState.selected).toBe(true);
    button(screen.render(), 'Fermer').props.onPress();
    expect(selectedBrand(screen)).toBe('Atelier photo');
    expect(api.addClothing).not.toHaveBeenCalled();
  });
  test('permet de conserver ou saisir une marque si le catalogue est indisponible', async () => {
    const { screen, api } = mount(clothing, { getBrandCatalogue: jest.fn().mockRejectedValue(new Error('réseau')) });
    button(screen.render(), 'Choisir une marque').props.onPress(); await flush();
    expect(text(screen.render())).toContain('Impossible de charger les marques');
    expect(button(screen.render(), 'Sélectionner la marque Test')).toBeDefined();
    field(screen, 'Rechercher une marque').props.onChangeText('Nouvelle marque');
    button(screen.render(), 'Utiliser « Nouvelle marque »').props.onPress();
    await button(screen.render(), 'Enregistrer les modifications').props.onPress();
    expect(api.updateClothing.mock.calls[0][1].marque).toBe('Nouvelle marque');
  });
  test('signale le mode dégradé et recharge les marques personnelles à la prochaine ouverture', async () => {
    const { screen, api } = mount(null, { getBrandCatalogue: jest.fn()
      .mockResolvedValueOnce({ brands: [{ name: 'Nike' }], personalAvailable: false })
      .mockResolvedValue({ brands: [{ name: 'Nike' }, { name: 'Mon atelier', personal: true }], personalAvailable: true }) });
    button(screen.render(), 'Choisir une marque').props.onPress(); await flush();
    expect(text(screen.render())).toContain('tes marques personnelles n’ont pas pu être chargées');
    button(screen.render(), 'Fermer').props.onPress();
    button(screen.render(), 'Choisir une marque').props.onPress(); await flush();
    expect(button(screen.render(), 'Sélectionner la marque Mon atelier')).toBeDefined();
    expect(api.getBrandCatalogue).toHaveBeenCalledTimes(2);
  });
  test('ignore le catalogue reçu après la fermeture puis permet de réessayer', async () => {
    let resolve;
    const { screen } = mount(null, { getBrandCatalogue: jest.fn()
      .mockImplementationOnce(() => new Promise(done => { resolve = done; }))
      .mockResolvedValue({ brands: [{ name: 'Nike' }] }) });
    button(screen.render(), 'Choisir une marque').props.onPress();
    button(screen.render(), 'Fermer').props.onPress();
    resolve({ brands: [{ name: 'Marque périmée' }] }); await flush();
    button(screen.render(), 'Choisir une marque').props.onPress(); await flush();
    expect(text(screen.render())).not.toContain('Marque périmée');
    expect(button(screen.render(), 'Sélectionner la marque Nike')).toBeDefined();
  });
  test('ne propose pas de marque vide ou de doublon Sans marque', async () => {
    const { screen } = mount(null);
    button(screen.render(), 'Choisir une marque').props.onPress(); await flush();
    for (const query of ['   ', '---', 'Sans marque']) {
      field(screen, 'Rechercher une marque').props.onChangeText(query);
      expect(nodes(screen.render()).some(node => node.type === 'TouchableOpacity' &&
        node.props.accessibilityLabel?.startsWith('Utiliser «'))).toBe(false);
    }
  });
});

describe('Catalogue enrichi et deux couleurs', () => {
  const options = { version: 3, max_colors: 2, colors: ['noir','blanc','bleu','bleu marine','écru'],
    groups: [{ id_categorie: 'mailles', nom_categorie: 'Pulls et sweats', subcategories: [{ id_sous_categorie: 12, nom_sous_categorie: 'Cardigan' }] }] };
  test('choisit une famille précise et persiste deux couleurs, températures existantes conservées', async () => {
    const { screen, api } = mount(clothing, { getWardrobeOptions: jest.fn().mockResolvedValue(options) });
    await flush();
    button(screen.render(), 'Choisir une catégorie').props.onPress(); await flush();
    button(screen.render(), 'Pulls et sweats').props.onPress(); await flush();
    button(screen.render(), 'Cardigan').props.onPress();
    button(screen.render(), 'Couleur blanc').props.onPress(); // retire la principale existante
    button(screen.render(), 'Couleur bleu marine').props.onPress();
    button(screen.render(), 'Couleur écru').props.onPress();
    await button(screen.render(), 'Enregistrer les modifications').props.onPress();
    expect(api.updateClothing).toHaveBeenCalledWith(7, expect.objectContaining({
      couleur: 'bleu marine', couleur_secondaire: 'écru', id_sous_categorie: 12, temperature_min: 0, temperature_max: 30
    }));
    expect(api.getSousCategoriesByCategorie).not.toHaveBeenCalled();
  });
  test('préremplit, protège la seconde couleur manuelle et permet de la retirer', async () => {
    const { screen, api } = mount(null, { getWardrobeOptions: jest.fn().mockResolvedValue(options),
      analyzeClothingImage: jest.fn().mockResolvedValue({ nom: 'Pull', couleur: 'noir', couleur_secondaire: 'blanc', id_sous_categorie: 12, nom_sous_categorie: 'Cardigan' }) });
    await flush();
    await button(screen.render(), 'Ajouter une photo').props.onPress();
    button(screen.render(), 'Couleur blanc').props.onPress(); // retire la suggestion secondaire
    button(screen.render(), 'Couleur écru').props.onPress();
    await button(screen.render(), 'Changer la photo du vêtement').props.onPress();
    await button(screen.render(), 'Ajouter à mon dressing').props.onPress();
    expect(api.addClothing).toHaveBeenLastCalledWith(expect.objectContaining({ couleur: 'noir', couleur_secondaire: 'écru' }));
    button(screen.render(), 'Retirer la seconde couleur').props.onPress();
    await button(screen.render(), 'Ajouter à mon dressing').props.onPress();
    expect(api.addClothing).toHaveBeenLastCalledWith(expect.objectContaining({ couleur_secondaire: null }));
  });
  test('serveur ancien ou indisponible : conserve le contrat à une couleur', async () => {
    const { screen, api } = mount(clothing, { getWardrobeOptions: jest.fn().mockRejectedValue(new Error('hors ligne')) });
    await flush();
    expect(text(screen.render())).not.toContain('Secondaire');
    expect(nodes(screen.render()).some(node => node.props?.accessibilityLabel === 'Couleur bleu marine')).toBe(false);
    await button(screen.render(), 'Enregistrer les modifications').props.onPress();
    expect(api.updateClothing.mock.calls[0][1]).not.toHaveProperty('couleur_secondaire');
  });
  test('une annonce tardive des nouveaux groupes ne bloque pas un catalogue historique déjà ouvert', async () => {
    let announce;
    const { screen, api } = mount(null, { getWardrobeOptions: jest.fn(() => new Promise(resolve => { announce = resolve; })) });
    button(screen.render(), 'Choisir une catégorie').props.onPress(); await flush();
    announce(options); await flush();
    button(screen.render(), 'Vêtements').props.onPress(); await flush();
    expect(api.getSousCategoriesByCategorie).toHaveBeenCalledWith(2);
    expect(text(screen.render())).toContain('Chemises');
  });

  test('deux appuis cochent simultanément les deux couleurs et un troisième ne les remplace pas', async () => {
    const { screen, api } = mount(clothing, { getWardrobeOptions: jest.fn().mockResolvedValue(options) });
    await flush();
    button(screen.render(), 'Couleur bleu').props.onPress();
    expect(button(screen.render(), 'Couleur blanc').props.accessibilityState.selected).toBe(true);
    expect(button(screen.render(), 'Couleur bleu').props.accessibilityState.selected).toBe(true);
    button(screen.render(), 'Couleur noir').props.onPress();
    expect(button(screen.render(), 'Couleur noir').props.accessibilityState.selected).toBe(false);
    expect(text(screen.render())).toContain('Deux couleurs maximum');
    await button(screen.render(), 'Enregistrer les modifications').props.onPress();
    expect(api.updateClothing).toHaveBeenLastCalledWith(7, expect.objectContaining({ couleur:'blanc', couleur_secondaire:'bleu' }));
  });
  test('retirer la principale promeut la seconde et permet de choisir une nouvelle couleur', async () => {
    const { screen, api } = mount(clothing, { getWardrobeOptions: jest.fn().mockResolvedValue(options) });
    await flush();
    button(screen.render(), 'Couleur bleu').props.onPress();
    button(screen.render(), 'Couleur blanc').props.onPress();
    button(screen.render(), 'Couleur noir').props.onPress();
    await button(screen.render(), 'Enregistrer les modifications').props.onPress();
    expect(api.updateClothing).toHaveBeenLastCalledWith(7, expect.objectContaining({ couleur:'bleu', couleur_secondaire:'noir' }));
    button(screen.render(), 'Couleur noir').props.onPress();
    await button(screen.render(), 'Enregistrer les modifications').props.onPress();
    expect(api.updateClothing).toHaveBeenLastCalledWith(7, expect.objectContaining({ couleur:'bleu', couleur_secondaire:null }));
  });
  test('une fiche conservée recharge les capacités au retour, sans appliquer une réponse antérieure', async () => {
    let resolveInitial;
    const getWardrobeOptions = jest.fn().mockImplementationOnce(() => new Promise(resolve => { resolveInitial = resolve; }))
      .mockResolvedValue(options);
    const { screen, navigation } = mount(clothing, { getWardrobeOptions });
    const focus = navigation.addListener.mock.calls.find(([event]) => event === 'focus')[1];
    await focus();
    resolveInitial({ max_colors:1, colors:['blanc'] }); await flush();
    button(screen.render(), 'Couleur bleu').props.onPress();
    expect(button(screen.render(), 'Couleur blanc').props.accessibilityState.selected).toBe(true);
    expect(button(screen.render(), 'Couleur bleu').props.accessibilityState.selected).toBe(true);
  });
  test('une fiche bicolore réouverte montre les deux couleurs sélectionnées', async () => {
    const { screen } = mount({ ...clothing, couleur_secondaire:'bleu' }, { getWardrobeOptions: jest.fn().mockResolvedValue(options) });
    await flush();
    expect(button(screen.render(), 'Couleur blanc').props.accessibilityState.selected).toBe(true);
    expect(button(screen.render(), 'Couleur bleu').props.accessibilityState.selected).toBe(true);
  });

});
