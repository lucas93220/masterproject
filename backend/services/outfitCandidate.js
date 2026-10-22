// Règles de composition initiales : elles filtrent les candidats avant le score ML.
// Les seuils sont des heuristiques de confort, pas des préférences apprises.
const { colorBucket } = require('./clothingColors');

const WARM_WEATHER = 20;
const LAYERING_WEATHER = 15;
const HEAVY_OUTER_WEATHER = 12;
const HEAVY_OUTER_SOFT_LIMIT = 18;
const HEAVY_OUTER_TOLERANCE = 6;
const SUNNY_ICONS = new Set(['01d', '02d']);
const NEUTRAL_COLORS = new Set(['noir', 'blanc', 'gris', 'marron', 'beige']);

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function isWarmTop(item) {
  const description = normalize(`${item.sous_categorie?.nom_sous_categorie || ''} ${item.nom || ''}`);
  return /\b(pull|pulls|sweat|sweats|polaire|gilet|gilets)\b/.test(description);
}

function isBaseTop(item) {
  const description = normalize(`${item.sous_categorie?.nom_sous_categorie || ''} ${item.nom || ''}`);
  return /\b(t-shirts?|tee-shirts?|debardeurs?)\b/.test(description);
}

function isShirt(item) {
  const description = normalize(`${item.sous_categorie?.nom_sous_categorie || ''} ${item.nom || ''}`);
  return /\bchemises?\b/.test(description);
}

function isHeavyOuter(item) {
  const name = normalize(item.nom);
  return /\b(doudoune|doudounes|manteau|manteaux|parka|parkas|laine)\b/.test(name);
}

function isTemperatureEligible(item, temperature) {
  if (temperature < item.temperature_min) return false;
  if (temperature <= item.temperature_max) return true;
  // Une plage renseignée reste la référence ; une petite marge permet de proposer
  // une couche extérieure à 13 °C si sa limite est 12 °C, sans modifier le dressing.
  return normalize(item.sous_categorie?.zone?.nom_zone) === 'exterieur' &&
    temperature <= HEAVY_OUTER_SOFT_LIMIT &&
    temperature <= item.temperature_max + HEAVY_OUTER_TOLERANCE;
}

function isTooWarmAccessory(item, zoneName, temperature, weatherIcon) {
  const description = normalize(`${item.sous_categorie?.nom_sous_categorie || ''} ${item.nom || ''}`);
  if (zoneName === 'yeux' && /\blunettes? de soleil\b/.test(description)) {
    return !SUNNY_ICONS.has(weatherIcon);
  }
  if (zoneName === 'mains') return temperature > HEAVY_OUTER_WEATHER;
  if (zoneName === 'tete') return temperature > HEAVY_OUTER_WEATHER &&
    /\b(bonnet|bonnets)\b/.test(description);
  if (zoneName === 'cou') return temperature > HEAVY_OUTER_WEATHER &&
    /\b(echarpe|echarpes)\b/.test(description);
  return false;
}

function pick(items, random) {
  return items[Math.floor(random() * items.length)];
}

function keepsColorSimple(outfit, item) {
  const accents = new Set([...outfit, item].map(clothing => colorBucket(clothing.couleur))
    .filter(color => !NEUTRAL_COLORS.has(color) && color !== 'autre' && color !== 'inconnu'));
  return accents.size <= 2;
}

function buildRandomTenue(vetementsFiltres, zones, temperature, random = Math.random,
  weatherIcon = null) {
  const tenue = [];
  let warmTopChosen = false;
  // Les zones obligatoires sont choisies avant les accessoires pour éviter
  // qu'une couleur d'accessoire dicte celle du haut ou du pantalon.
  const priority = zone => normalize(zone.nom_zone) === 'torse' ? 0 : zone.obligatoire ? 1 : 2;
  const orderedZones = [...zones].sort((a, b) => priority(a) - priority(b));

  for (const zone of orderedZones) {
    const zoneName = normalize(zone.nom_zone);
    const requiredColdOuter = zoneName === 'exterieur' &&
      temperature <= HEAVY_OUTER_WEATHER;
    const maxElements = Number(zone.max_elements);
    let options = vetementsFiltres.filter(item =>
      item.sous_categorie?.zone?.id_zone === zone.id_zone);

    if (zoneName === 'exterieur') {
      if (temperature >= WARM_WEATHER) continue;
      if (temperature > HEAVY_OUTER_SOFT_LIMIT) {
        options = options.filter(item => !isHeavyOuter(item));
      }
      if (temperature >= 16 && warmTopChosen) continue;
    } else if (!zone.obligatoire) {
      options = options.filter(item => !isTooWarmAccessory(item, zoneName, temperature,
        weatherIcon));
    }

    if (!options.length || maxElements < 1) {
      if (zone.obligatoire) return null;
      continue;
    }

    const colorCompatible = options.filter(item => keepsColorSimple(tenue, item));
    if (colorCompatible.length) options = colorCompatible;
    else if (!zone.obligatoire && !requiredColdOuter) continue;

    if (!zone.obligatoire && !requiredColdOuter && random() >= 0.5) continue;

    if (zoneName === 'torse') {
      const lightTops = options.filter(item => !isWarmTop(item));
      const baseTops = options.filter(isBaseTop);
      let firstOptions = options;
      if (temperature <= HEAVY_OUTER_WEATHER && baseTops.length) firstOptions = baseTops;
      else if (temperature >= WARM_WEATHER && lightTops.length) firstOptions = lightTops;
      const first = pick(firstOptions, random);
      tenue.push(first);
      warmTopChosen = isWarmTop(first);

      if (temperature <= LAYERING_WEATHER && maxElements > 1) {
        let secondOptions = options.filter(item =>
          item.id_sous_categorie !== first.id_sous_categorie &&
          (isWarmTop(item) !== warmTopChosen ||
            (temperature <= HEAVY_OUTER_WEATHER &&
              ((isBaseTop(first) && isShirt(item)) ||
                (isShirt(first) && isBaseTop(item))))));
        if (temperature <= HEAVY_OUTER_WEATHER && isBaseTop(first)) {
          const warmSeconds = secondOptions.filter(isWarmTop);
          if (warmSeconds.length) secondOptions = warmSeconds;
        }
        const colorCompatibleSecond = secondOptions.filter(item => keepsColorSimple(tenue, item));
        if (colorCompatibleSecond.length) secondOptions = colorCompatibleSecond;
        if (secondOptions.length) tenue.push(pick(secondOptions, random));
      }
      continue;
    }

    const selectedSubcategories = new Set();
    while (options.length && selectedSubcategories.size < maxElements) {
      const colorCompatibleNext = options.filter(item => keepsColorSimple(tenue, item));
      if (colorCompatibleNext.length) options = colorCompatibleNext;
      else if (!zone.obligatoire && !requiredColdOuter) break;
      const chosen = pick(options, random);
      tenue.push(chosen);
      selectedSubcategories.add(chosen.id_sous_categorie);
      options = options.filter(item => item.id_sous_categorie !== chosen.id_sous_categorie);
    }
  }

  // Un sous-vêtement caché sous un pull et une veste n'apporte rien à la
  // suggestion affichée : ne garder que le haut visible sous la couche extérieure.
  if (tenue.some(item => normalize(item.sous_categorie?.zone?.nom_zone) === 'exterieur')) {
    const tops = tenue.filter(item => normalize(item.sous_categorie?.zone?.nom_zone) === 'torse');
    if (tops.length > 1) {
      const visibleTop = tops.find(isWarmTop) || tops.find(isShirt) || tops[tops.length - 1];
      for (const top of tops) {
        if (top !== visibleTop) tenue.splice(tenue.indexOf(top), 1);
      }
    }
  }

  const zoneOrder = new Map(zones.map((zone, index) => [zone.id_zone, index]));
  return tenue.sort((a, b) =>
    zoneOrder.get(a.sous_categorie.zone.id_zone) -
    zoneOrder.get(b.sous_categorie.zone.id_zone));
}

module.exports = { buildRandomTenue, isTemperatureEligible };
