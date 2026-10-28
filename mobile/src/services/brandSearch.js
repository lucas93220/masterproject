export const normalizeBrand = value => String(value || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

const names = brand => [brand.name, ...(brand.aliases || [])].map(normalizeBrand);

export function brandOptions(catalog, current, query = '') {
  const seen = new Set();
  const options = catalog.filter(brand => {
    if (!brand || typeof brand.name !== 'string' || !normalizeBrand(brand.name)) return false;
    const key = normalizeBrand(brand.name);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  const currentKey = normalizeBrand(current);
  if (currentKey && !options.some(brand => names(brand).includes(currentKey))) {
    options.unshift({ name: current, aliases: [], personal: true });
  }
  const term = normalizeBrand(query);
  const rank = brand => {
    const values = names(brand);
    if (term) return values.includes(term) ? 0 : values.some(value => value.startsWith(term)) ? 1 : 2;
    return brand.personal ? 0 : brand.popular ? 1 : 2;
  };
  return options.filter(brand => !term || names(brand).some(value => value.includes(term)))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'fr'));
}

export function customBrandAllowed(catalog, current, query) {
  const term = normalizeBrand(query);
  return !!term && term !== 'sansmarque' &&
    !brandOptions(catalog, current).some(brand => names(brand).includes(term));
}
