const { wardrobeV3 } = require('./wardrobeVersion');
const { SELECTABLE_COLORS } = require('./clothingColors');
const GROUPS = [
  ['hauts', 'Hauts'], ['mailles', 'Pulls et sweats'], ['exterieur', 'Vestes et manteaux'],
  ['bas', 'Bas'], ['chaussures', 'Chaussures'], ['accessoires', 'Accessoires']
];
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function groupFor(item) {
  const name = normalize(item.nom_sous_categorie);
  const zone = normalize(item.zone?.nom_zone);
  const parent = normalize(item.categorie?.nom_categorie);
  if (zone === 'pieds' || /chaussure/.test(parent)) return 'chaussures';
  if (zone === 'exterieur') return 'exterieur';
  if (zone === 'jambes') return 'bas';
  if (zone === 'torse') return /pull|sweat|gilet|cardigan|polaire/.test(name) ? 'mailles' : 'hauts';
  if (/accessoire/.test(parent) || ['tete', 'yeux', 'cou', 'mains', 'taille', 'sac', 'accessoires'].includes(zone)) return 'accessoires';
  return 'autres';
}
function catalogue(subcategories) {
  const groups = [...GROUPS, ['autres', 'Autres pièces']].map(([id, name]) => ({
    id_categorie: id, nom_categorie: name,
    subcategories: subcategories.filter(item => groupFor(item) === id).map(item => ({
      id_sous_categorie: item.id_sous_categorie, nom_sous_categorie: item.nom_sous_categorie
    })).sort((a, b) => a.nom_sous_categorie.localeCompare(b.nom_sous_categorie, 'fr'))
  })).filter(group => group.subcategories.length);
  return { version: wardrobeV3() ? 3 : 2, max_colors: wardrobeV3() ? 2 : 1,
    colors: SELECTABLE_COLORS, groups };
}
module.exports = { catalogue, groupFor };
