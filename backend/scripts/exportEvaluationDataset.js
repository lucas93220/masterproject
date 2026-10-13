// Export en lecture seule, hors du démarrage de l'application.
const fs = require('node:fs/promises');
const path = require('node:path');

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  const userId = Number(process.argv[2]);
  const output = process.argv[3] && path.resolve(process.argv[3]);
  const repoRoot = path.resolve(__dirname, '..', '..');
  if (!Number.isSafeInteger(userId) || userId <= 0 || userId > 2147483647 || !output) {
    throw new Error('Usage : node scripts/exportEvaluationDataset.js <id_utilisateur> <fichier.json>');
  }
  if (output === repoRoot || output.startsWith(`${repoRoot}${path.sep}`)) {
    throw new Error('Enregistrez les données utilisateur hors du dépôt Git.');
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST) ||
      process.env.DB_NAME !== 'fits' || process.env.NODE_ENV === 'production') {
    throw new Error('Export réservé à la base de développement fits en local.');
  }

  const { sequelize, mongoose } = require('../config/db');
  require('../models');
  const { loadFeatureSchema } = require('../services/outfitFeatures');
  const { buildTrainingDataset } = require('../services/trainingDataset');
  try {
    const [identity] = await sequelize.query(
      'SELECT current_database() AS database, host(inet_server_addr()) AS address'
    );
    if (identity[0]?.database !== 'fits' ||
        !['127.0.0.1', '::1'].includes(identity[0]?.address)) {
      throw new Error('Le serveur PostgreSQL ne correspond pas à la base locale attendue.');
    }
    const schema = await loadFeatureSchema();
    const data = await buildTrainingDataset(userId, schema, { includeTenueId: true });
    const payload = {
      source: 'Export de la base locale fits ; provenance des avis à confirmer',
      user_id: userId,
      feature_version: schema.version,
      data
    };
    await fs.writeFile(output, JSON.stringify(payload, null, 2), { flag: 'wx', mode: 0o600 });
    console.log(`Export de ${data.length} avis vers ${output}`);
  } finally {
    await Promise.allSettled([sequelize.close(), mongoose.disconnect()]);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { main };
