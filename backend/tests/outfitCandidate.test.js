const { buildRandomTenue } = require('../services/outfitCandidate');

const zones = [
  { id_zone: 1, nom_zone: 'tete', max_elements: 1, obligatoire: false },
  { id_zone: 2, nom_zone: 'torse', max_elements: 2, obligatoire: true },
  { id_zone: 3, nom_zone: 'exterieur', max_elements: 1, obligatoire: false },
  { id_zone: 4, nom_zone: 'jambes', max_elements: 1, obligatoire: true },
  { id_zone: 5, nom_zone: 'pieds', max_elements: 1, obligatoire: true },
  { id_zone: 6, nom_zone: 'yeux', max_elements: 1, obligatoire: false },
  { id_zone: 7, nom_zone: 'cou', max_elements: 1, obligatoire: false }
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

test('par temps froid, le manteau disponible reste présent même si les accessoires sont omis', () => {
  const outfit = buildRandomTenue(clothes, zones, 8, () => 0.9);
  expect(outfit.some(item => item.sous_categorie.zone.nom_zone === 'tete')).toBe(false);
  expect(outfit.some(item => item.sous_categorie.zone.nom_zone === 'exterieur')).toBe(true);
  expect(buildRandomTenue(clothes.filter(item => item.id_vetement !== 7),
    zones, 8, () => 0)).toBeNull();
});

test('à 9 °C, une chemise peut se porter sur un t-shirt avec un manteau', () => {
  const shirt = garment(8, 'torse', 'Chemises', 'Chemise');
  const outfit = buildRandomTenue([clothes[2], shirt, clothes[4], clothes[5], clothes[6]],
    zones, 9, () => 0.9);
  expect(outfit.map(item => item.id_vetement)).toEqual([3, 8, 5, 6, 7]);
});

test('par temps froid, le choix de la couche extérieure ne force pas le manteau en laine', () => {
  const zip = garment(8, 'exterieur', 'Vestes et manteaux', 'Zip léger');
  const outfit = buildRandomTenue([clothes[2], zip, clothes[4], clothes[5], clothes[6]],
    zones, 9, () => 0);
  expect(outfit.some(item => item.id_vetement === 8)).toBe(true);
  expect(outfit.some(item => item.id_vetement === 5)).toBe(false);
});

test('les lunettes de soleil demandent un ciel dégagé de jour ; les autres lunettes restent possibles', () => {
  const sunglasses = garment(8, 'yeux', 'Lunettes de soleil', 'Lunettes de soleil');
  const glasses = garment(9, 'yeux', 'Lunettes de vue', 'Lunettes de vue');
  const wardrobe = [clothes[2], clothes[5], clothes[6], sunglasses, glasses];
  const sunny = buildRandomTenue(wardrobe, zones, 18, () => 0, '01d');
  const cloudy = buildRandomTenue(wardrobe, zones, 18, () => 0, '04d');
  const noWeather = buildRandomTenue(wardrobe, zones, 18, () => 0);
  expect(sunny.some(item => item.id_vetement === 8)).toBe(true);
  expect(cloudy.some(item => item.id_vetement === 8)).toBe(false);
  expect(noWeather.some(item => item.id_vetement === 8)).toBe(false);
  expect(cloudy.some(item => item.id_vetement === 9)).toBe(true);
});

test('casquette, lunettes et écharpe peuvent coexister dans leurs zones distinctes', () => {
  const sunglasses = garment(8, 'yeux', 'Lunettes de soleil', 'Lunettes de soleil');
  const scarf = garment(9, 'cou', 'Echarpes', 'Echarpe');
  const outfit = buildRandomTenue([...clothes.slice(1), sunglasses, scarf],
    zones, 9, () => 0, '01d');
  expect(outfit.map(item => item.id_vetement)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
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
