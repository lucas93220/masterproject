// Mesure préquentielle en lecture seule : seules les prédictions consignées
// avant le vote comptent. Aucun entraînement ni écriture applicative.
const path = require('node:path');

function reportProspective(traces, evaluations) {
  const votes = evaluations.map(row => ({
    id: Number(row.id_tenue), label: row.is_liked === true || row.is_liked === 1 ? 1 : 0,
    date: new Date(row.date_avis).getTime(), temperature: row.temperature
  })).filter(row => Number.isSafeInteger(row.id) && Number.isFinite(row.date));
  const byOutfit = new Map(votes.map(row => [row.id, row]));
  const report = { recorded: traces.length, personalized: 0, fallback: 0,
    missing_vote: 0, invalid_or_late: 0, evaluated: 0,
    likes: 0, dislikes: 0, correct_model: 0, correct_prior_majority: 0,
    confusion: { true_dislikes: 0, false_likes: 0, false_dislikes: 0, true_likes: 0 },
    by_temperature: {},
    probability_bands: Array.from({ length: 5 }, (_, index) => ({
      range: `${(index / 5).toFixed(1)}–${((index + 1) / 5).toFixed(1)}`,
      n: 0, likes: 0
    })),
    brier: null };
  let squaredError = 0;
  for (const trace of traces) {
    const detail = trace.details || {};
    if (detail.model_used !== 'personalized') { report.fallback++; continue; }
    report.personalized++;
    const time = new Date(trace.date).getTime();
    const probability = detail.probability_like;
    const vote = byOutfit.get(detail.id_tenue);
    if (!vote) { report.missing_vote++; continue; }
    if (!Number.isFinite(time) || vote.date <= time ||
        typeof probability !== 'number' || !Number.isFinite(probability) ||
        probability < 0 || probability > 1 ||
        !Number.isSafeInteger(detail.id_tenue)) {
      report.invalid_or_late++; continue;
    }
    const prior = votes.filter(row => row.date < time);
    if (!prior.length) { report.invalid_or_late++; continue; }
    const priorLikes = prior.filter(row => row.label === 1).length;
    const baseline = priorLikes > prior.length - priorLikes ? 1 : 0;
    const predicted = probability > 0.5 ? 1 : 0;
    report.evaluated++;
    if (vote.label) report.likes++; else report.dislikes++;
    if (predicted === vote.label) report.correct_model++;
    if (baseline === vote.label) report.correct_prior_majority++;
    if (typeof vote.temperature === 'number' && Number.isFinite(vote.temperature)) {
      const key = String(vote.temperature);
      const group = report.by_temperature[key] ||= { n: 0, likes: 0,
        correct_model: 0, correct_prior_majority: 0 };
      group.n++;
      group.likes += vote.label;
      group.correct_model += Number(predicted === vote.label);
      group.correct_prior_majority += Number(baseline === vote.label);
    }
    const cell = vote.label
      ? (predicted ? 'true_likes' : 'false_dislikes')
      : (predicted ? 'false_likes' : 'true_dislikes');
    report.confusion[cell]++;
    const band = report.probability_bands[Math.min(Math.floor(probability * 5), 4)];
    band.n++;
    band.likes += vote.label;
    squaredError += (probability - vote.label) ** 2;
  }
  if (report.evaluated) {
    report.accuracy_model = report.correct_model / report.evaluated;
    report.accuracy_prior_majority = report.correct_prior_majority / report.evaluated;
    report.brier = squaredError / report.evaluated;
  }
  return report;
}

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
  const userId = Number(process.argv[2]);
  if (!Number.isSafeInteger(userId) || userId <= 0 || userId > 2147483647 || process.argv.length !== 3) {
    throw new Error('Usage : node scripts/reportProspectivePredictions.js <id_utilisateur>');
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST) ||
      process.env.DB_NAME !== 'fits' || process.env.NODE_ENV === 'production') {
    throw new Error('Rapport réservé à la base de développement fits en local.');
  }
  const { QueryTypes } = require('sequelize');
  const { sequelize, mongoose } = require('../config/db');
  const Log = require('../models/log');
  try {
    const [identity] = await sequelize.query(
      'SELECT current_database() AS database, host(inet_server_addr()) AS address');
    if (identity[0]?.database !== 'fits' ||
        !['127.0.0.1', '::1'].includes(identity[0]?.address)) {
      throw new Error('Le serveur PostgreSQL ne correspond pas à la base locale attendue.');
    }
    await mongoose.connection.asPromise();
    const [traces, evaluations] = await Promise.all([
      Log.find({ userId: String(userId), action: 'outfit_prediction' })
        .select('date details -_id').sort({ date: 1 }).lean(),
      // Les dates Sequelize sont écrites en UTC dans un timestamp SQL sans fuseau.
      // Les lire comme UTC évite que le fuseau macOS décale le vote de deux heures.
      sequelize.query(`SELECT id_tenue, is_liked, temperature,
        date_avis AT TIME ZONE 'UTC' AS date_avis FROM evaluation
        WHERE id_utilisateur = :userId AND feature_snapshot->>'version' = '2'`,
        { replacements: { userId }, type: QueryTypes.SELECT })
    ]);
    console.log(JSON.stringify(reportProspective(traces, evaluations), null, 2));
  } finally {
    await Promise.allSettled([sequelize.close(), mongoose.disconnect()]);
  }
}

if (require.main === module) main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

module.exports = { reportProspective };
