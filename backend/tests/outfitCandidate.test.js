const { buildRandomTenue } = require('../services/outfitCandidate');

const zones = [
  { id_zone: 1, nom_zone: 'tete', max_elements: 1, obligatoire: false },
  { id_zone: 2, nom_zone: 'torse', max_elements: 2, obligatoire: true },
  { id_zone: 3, nom_zone: 'exterieur', max_elements: 1, obligatoire: false },
  { id_zone: 4, nom_zone: 'jambes', max_elements: 1, obligatoire: true },
  { id_zone: 5, nom_zone: 'pieds', max_elements: 1, obligatoire: true }
];

function garment(id, zone, subcategory, name) {
  return { id_vetement: id, id_sous_categorie: id, nom: name,
    sous_categorie: { nom_sous_categorie: subcategory,
      zone: zones.find(item => item.nom_zone === zone) } };
}

const clothes = [
  garment(1, 'tete', 'Bonnets', 'Bonnet en laine'),
  garment(2, 'tete', 'Casquettes', 'Casquette'),
  garment(3, 'torse', 'T-shirts et débardeurs', 'T-shirt manches longues'),
  garment(4, 'torse', 'Sweats et pulls', 'Pull'),
  garment(5, 'exterieur', 'Vestes et manteaux', 'Manteau en laine'),
  garment(6, 'jambes', 'Pantalon', 'Pantalon'),
  garment(7, 'pieds', 'Sneakers', 'Baskets')
];

test('à 22 °C, ne cumule pas t-shirt, pull et manteau malgré leurs plages individuelles', () => {
  const outfit = buildRandomTenue(clothes, zones, 22, () => 0);
  expect(outfit.map(item => item.id_vetement)).toEqual([2, 3, 6, 7]);
});

test('par temps froid, une base légère, un pull et un manteau restent possibles', () => {
  const outfit = buildRandomTenue(clothes, zones, 8, () => 0);
  expect(outfit.map(item => item.id_vetement)).toEqual([1, 3, 4, 5, 6, 7]);
});

test('un haut chaud suffit à 17 °C et exclut une veste supplémentaire', () => {
  const zip = garment(8, 'exterieur', 'Vestes et manteaux', 'Zip léger');
  const outfit = buildRandomTenue([clothes[3], zip, clothes[5], clothes[6]], zones, 17, () => 0);
  expect(outfit.map(item => item.id_vetement)).toEqual([4, 6, 7]);
});

test('une veste légère reste possible à 17 °C avec un t-shirt', () => {
  const zip = garment(8, 'exterieur', 'Vestes et manteaux', 'Zip léger');
  const outfit = buildRandomTenue([clothes[2], zip, clothes[5], clothes[6]], zones, 17, () => 0);
  expect(outfit.map(item => item.id_vetement)).toEqual([3, 8, 6, 7]);
});

test('garde une tenue possible si le seul haut disponible est un pull', () => {
  const outfit = buildRandomTenue([clothes[3], clothes[4], clothes[5], clothes[6]],
    zones, 22, () => 0);
  expect(outfit.map(item => item.id_vetement)).toEqual([4, 6, 7]);
});

test('les accessoires facultatifs peuvent être omis et les zones obligatoires restent exigées', () => {
  const outfit = buildRandomTenue(clothes, zones, 8, () => 0.9);
  expect(outfit.some(item => item.sous_categorie.zone.nom_zone === 'tete')).toBe(false);
  expect(outfit.some(item => item.sous_categorie.zone.nom_zone === 'exterieur')).toBe(false);
  expect(buildRandomTenue(clothes.filter(item => item.id_vetement !== 7),
    zones, 8, () => 0)).toBeNull();
});

test('préfère une chaussure neutre à une troisième couleur vive sans bloquer un dressing réduit', () => {
  const top = { ...clothes[2], couleur: 'rouge' };
  const pants = { ...clothes[5], couleur: 'jaune' };
  const blueShoes = { ...clothes[6], couleur: 'bleu' };
  const blackShoes = { ...garment(9, 'pieds', 'Sneakers', 'Baskets noires'), couleur: 'noir' };

  const outfit = buildRandomTenue([top, pants, blueShoes, blackShoes], zones, 22, () => 0);
  expect(outfit.map(item => item.id_vetement)).toEqual([3, 6, 9]);
  expect(buildRandomTenue([top, pants, blueShoes], zones, 22, () => 0)
    .map(item => item.id_vetement)).toEqual([3, 6, 7]);
});
