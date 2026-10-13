// Reprend uniquement les nettoyages d'un compte déjà supprimé en SQL.
require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env'), quiet: true });
const { sequelize, mongoose } = require('../config/db');
const { retryPendingCleanup } = require('../services/accountDeletion');

async function main() {
  try {
    const results = await retryPendingCleanup();
    for (const result of results) {
      console.log(`Compte ${result.userId}: ${result.complete ? 'nettoyage terminé' :
        `en attente (${(result.pending || [result.reason]).join(', ')})`}`);
    }
    if (results.some(result => !result.complete)) process.exitCode = 1;
  } finally {
    await Promise.allSettled([sequelize.close(), mongoose.disconnect()]);
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
