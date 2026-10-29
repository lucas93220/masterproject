jest.mock('../config/db', () => { throw new Error('Aucun accès aux données réelles'); });
const { catalogue, groupFor } = require('../services/wardrobeCatalogue');
const previous = process.env.FITS_WARDROBE_V3;
afterEach(() => { if (previous === undefined) delete process.env.FITS_WARDROBE_V3; else process.env.FITS_WARDROBE_V3 = previous; });
test('regroupe par zone sans confondre gilet et veste ni perdre les types anciens', () => {
  const items = [['T-shirt','torse'],['Cardigan','torse'],['Blazer','exterieur'],['Jean','jambes'],['Baskets','pieds'],['Ceinture','taille'],['Ancien type','zone libre']]
    .map(([nom_sous_categorie,nom_zone], index) => ({ id_sous_categorie: index + 1, nom_sous_categorie, zone: { nom_zone } }));
  const result = catalogue(items);
  expect(result.groups.map(group => group.id_categorie)).toEqual(['hauts','mailles','exterieur','bas','chaussures','accessoires','autres']);
  expect(result.groups.flatMap(group => group.subcategories)).toHaveLength(items.length);
  expect(groupFor(items[1])).toBe('mailles');
});
test('annonce deux couleurs uniquement après activation et redémarrage', () => {
  process.env.FITS_WARDROBE_V3 = '0';
  expect(catalogue([]).max_colors).toBe(1);
  process.env.FITS_WARDROBE_V3 = '1';
  jest.isolateModules(() => {
    const enabled = require('../services/wardrobeCatalogue').catalogue([]);
    expect(enabled.max_colors).toBe(2);
    expect(enabled.colors).toEqual(expect.arrayContaining(['bleu marine','écru','doré']));
  });
});
