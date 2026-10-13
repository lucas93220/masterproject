const Evaluation = require('../models/evaluation');
const Tenue = require('../models/tenue');
const Composer = require('../models/composer');
const Vetement = require('../models/vetement');
const SousCategorie = require('../models/sousCategorie');
const Zone = require('../models/zone');

async function buildTrainingDataset(userId) {
  const evaluations = await Evaluation.findAll({
    where: { id_utilisateur: userId }
  });

  const validEvaluations = evaluations.filter(evaluation =>
    evaluation.id_utilisateur === userId &&
    Number.isInteger(evaluation.id_tenue) &&
    Number.isInteger(evaluation.temperature) &&
    typeof evaluation.is_liked === 'boolean'
  );

  if (!validEvaluations.length) return [];

  const tenueIds = [...new Set(validEvaluations.map(evaluation => evaluation.id_tenue))];
  const tenues = await Tenue.findAll({
    where: { id_tenue: tenueIds, id_utilisateur: userId }
  });
  const ownedTenues = new Map(tenues
    .filter(tenue => tenue.id_utilisateur === userId)
    .map(tenue => [tenue.id_tenue, tenue]));

  if (!ownedTenues.size) return [];

  const compositions = await Composer.findAll({
    where: { id_tenue: [...ownedTenues.keys()] }
  });
  const vetementIdsByTenue = new Map();

  for (const composition of compositions) {
    if (!ownedTenues.has(composition.id_tenue)) continue;
    if (!vetementIdsByTenue.has(composition.id_tenue)) {
      vetementIdsByTenue.set(composition.id_tenue, []);
    }
    vetementIdsByTenue.get(composition.id_tenue).push(composition.id_vetement);
  }

  const vetementIds = [...new Set([...vetementIdsByTenue.values()].flat())];
  if (!vetementIds.length) return [];

  const [vetements, zones] = await Promise.all([
    Vetement.findAll({
      where: { id_vetement: vetementIds },
      include: { model: SousCategorie, include: Zone }
    }),
    Zone.findAll()
  ]);
  const vetementsById = new Map(vetements.map(vetement => [vetement.id_vetement, vetement]));
  const zoneNames = new Set(zones.map(zone => zone.nom_zone));
  const dataset = [];

  for (const evaluation of validEvaluations) {
    const tenue = ownedTenues.get(evaluation.id_tenue);
    const ids = vetementIdsByTenue.get(evaluation.id_tenue);

    if (!tenue || tenue.temperature !== evaluation.temperature ||
        !ids?.length || new Set(ids).size !== ids.length) {
      continue;
    }

    const clothes = ids.map(id => vetementsById.get(id));
    if (clothes.some(vetement =>
      !vetement || typeof vetement.favori !== 'boolean' ||
      !zoneNames.has(vetement.sous_categorie?.zone?.nom_zone)
    )) {
      continue;
    }

    const nb_favoris = clothes.filter(vetement => vetement.favori).length;
    const row = {
      temperature: evaluation.temperature,
      nb_vetements: clothes.length,
      nb_favoris,
      ratio_favoris: nb_favoris / clothes.length,
      is_liked: evaluation.is_liked ? 1 : 0
    };

    for (const zone of zones) {
      row[`zone_${zone.nom_zone}`] = 0;
    }

    for (const vetement of clothes) {
      row[`zone_${vetement.sous_categorie.zone.nom_zone}`] = 1;
    }

    dataset.push(row);
  }

  return dataset;
}

module.exports = { buildTrainingDataset };
