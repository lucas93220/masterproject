const catalog = require('../data/clothingBrands.json');

const normalizeBrand = value => String(value || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

function brandCatalogue(personalNames = []) {
  const brands = catalog.map(item => ({ name: item.name, aliases: item.aliases || [],
    popular: item.popular === true, personal: false }));
  const byName = new Map();
  for (const brand of brands) {
    for (const name of [brand.name, ...brand.aliases]) byName.set(normalizeBrand(name), brand);
  }
  for (const value of personalNames) {
    if (typeof value !== 'string') continue;
    const name = value.trim();
    const key = normalizeBrand(name);
    if (!key) continue;
    if (byName.has(key)) { byName.get(key).personal = true; continue; }
    const brand = { name, aliases: [], popular: false, personal: true };
    brands.push(brand); byName.set(key, brand);
  }
  return brands.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

module.exports = { brandCatalogue, normalizeBrand };
