/* global jest, describe, test, expect */
const { createScreenHarness, nodes, text, button, flush } = require('./helpers/screenHarness');
const items = [
  { id_vetement: 1, nom: 'Chemise écrue', marque: 'Maison', couleur: 'blanc', favori: false, id_sous_categorie: 1, sous_categorie: { id_categorie: 1 } },
  { id_vetement: 2, nom: 'Baskets', marque: 'Studio', couleur: 'blanc', favori: true, id_sous_categorie: 2, sous_categorie: { id_categorie: 2 } },
  { id_vetement: 3, nom: 'Veste', marque: 'Studio', couleur: 'bleu', favori: true, id_sous_categorie: 1, sous_categorie: { id_categorie: 1 } }
];
async function mount(overrides = {}) {
  const api = { getMyDressing: jest.fn().mockResolvedValue({ vetements: items }),
    getCategories: jest.fn().mockResolvedValue([{ id_categorie: 1, nom_categorie: 'Vêtements' }, { id_categorie: 2, nom_categorie: 'Chaussures' }]),
    toggleFavorite: jest.fn().mockResolvedValue({}), deleteClothing: jest.fn().mockResolvedValue({}), ...overrides };
  const navigation = { addListener: jest.fn(() => jest.fn()), navigate: jest.fn() };
  const screen = createScreenHarness('dressing', api, { navigation });
  screen.render(); screen.effects.forEach(effect => effect()); await flush();
  return { screen, api, navigation };
}
const list = screen => nodes(screen.render()).find(node => node.type === 'FlatList').props.data;
const input = (screen, label) => nodes(screen.render()).find(node => node.type === 'TextInput' && node.props.accessibilityLabel === label);

describe('Dressing : recherche, filtres et mutations isolées', () => {
  test('recherche sans accents par nom ou marque, sans modifier les données sources', async () => {
    const { screen } = await mount();
    input(screen, 'Rechercher dans mon dressing').props.onChangeText('ecrue');
    expect(list(screen).map(item => item.id_vetement)).toEqual([1]);
    input(screen, 'Rechercher dans mon dressing').props.onChangeText('studio');
    expect(list(screen).map(item => item.id_vetement)).toEqual([3, 2]);
    expect(items.map(item => item.id_vetement)).toEqual([1, 2, 3]);
  });
  test('combine catégorie, favoris et couleur, puis réinitialise', async () => {
    const { screen } = await mount();
    button(screen.render(), 'Vêtements').props.onPress();
    button(screen.render(), 'Favoris').props.onPress();
    expect(list(screen).map(item => item.id_vetement)).toEqual([3]);
    button(screen.render(), 'Filtres, 2 actifs').props.onPress();
    button(screen.render(), 'blanc').props.onPress();
    expect(list(screen)).toEqual([]);
    expect(text(screen.render())).toContain('Aucune pièce trouvée');
    button(screen.render(), 'Réinitialiser').props.onPress();
    expect(list(screen)).toHaveLength(3);
  });
  test('tri alphabétique et ajouts récents restent des opérations locales', async () => {
    const { screen, api } = await mount();
    button(screen.render(), 'Filtres').props.onPress();
    button(screen.render(), 'Nom A–Z').props.onPress();
    expect(list(screen).map(item => item.id_vetement)).toEqual([2, 1, 3]);
    button(screen.render(), 'Ajouts récents').props.onPress();
    expect(list(screen).map(item => item.id_vetement)).toEqual([3, 2, 1]);
    expect(api.toggleFavorite).not.toHaveBeenCalled();
  });
  test('bloque les doubles favoris, conserve la valeur en cas d’erreur puis permet de réessayer', async () => {
    let reject;
    const { screen, api } = await mount({ toggleFavorite: jest.fn().mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; })).mockResolvedValue({}) });
    const like = button(screen.render(), 'Ajouter aux favoris : Chemise écrue');
    const saving = like.props.onPress();
    await like.props.onPress();
    expect(api.toggleFavorite).toHaveBeenCalledTimes(1);
    expect(button(screen.render(), 'Ajouter aux favoris : Chemise écrue').props.disabled).toBe(true);
    reject(new Error('Réseau indisponible')); await saving;
    expect(list(screen).find(item => item.id_vetement === 1).favori).toBe(false);
    await button(screen.render(), 'Ajouter aux favoris : Chemise écrue').props.onPress();
    expect(api.toggleFavorite).toHaveBeenLastCalledWith(1, false);
    expect(list(screen).find(item => item.id_vetement === 1).favori).toBe(true);
  });
  test('affiche une erreur de chargement et peut réessayer, sans faux dressing vide', async () => {
    const { screen, api } = await mount({ getMyDressing: jest.fn().mockRejectedValueOnce(new Error('Hors ligne')).mockResolvedValue({ vetements: items }) });
    expect(text(screen.render())).toContain('Hors ligne');
    expect(text(screen.render())).not.toContain('Tout commence par une pièce.');
    await button(screen.render(), 'Réessayer').props.onPress();
    expect(list(screen)).toHaveLength(3); expect(api.getMyDressing).toHaveBeenCalledTimes(2);
  });
  test('ouvre le vêtement sélectionné et confirme son retrait avant l’appel API', async () => {
    const { screen, api, navigation } = await mount();
    const edit = button(screen.render(), 'Modifier Veste');
    edit.props.onPress();
    expect(navigation.navigate).toHaveBeenCalledWith('AddClothing', { clothing: items[2] });
    edit.props.onLongPress();
    expect(api.deleteClothing).not.toHaveBeenCalled();
    await screen.alert.mock.calls[0][2][1].onPress();
    expect(api.deleteClothing).toHaveBeenCalledWith(3); expect(list(screen)).toHaveLength(2);
  });
});

test('filtre les groupes précis et trouve aussi la couleur secondaire', async () => {
  const { screen } = await mount({
    getMyDressing: jest.fn().mockResolvedValue({ vetements: [{ ...items[0], couleur_secondaire: 'bleu marine' }, items[1]] }),
    getWardrobeOptions: jest.fn().mockResolvedValue({ groups: [{ id_categorie: 'hauts', nom_categorie: 'Hauts',
      subcategories: [{ id_sous_categorie: 1, nom_sous_categorie: 'Chemise' }] }] })
  });
  button(screen.render(), 'Hauts').props.onPress();
  button(screen.render(), 'Filtres, 1 actifs').props.onPress();
  button(screen.render(), 'bleu marine').props.onPress();
  expect(list(screen).map(item => item.id_vetement)).toEqual([1]);
});
