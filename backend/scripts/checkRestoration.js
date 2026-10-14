// Contrôle SQL en lecture seule AVANT réouverture d'une sauvegarde locale.
// Les reçus doivent provenir du registre courant, conservé hors de la sauvegarde restaurée.
const path = require('node:path');
const { Client } = require('pg');
const { assertLocalDevelopment } = require('./diagnosePostgres');
const { readErasureReceipts, checkRestoredAccounts } = require('../services/erasureReceipts');

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
  assertLocalDevelopment(process.env);
  const client = new Client({ host: process.env.DB_HOST, port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 3000 });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const report = await checkRestoredAccounts(client, await readErasureReceipts());
    console.log(JSON.stringify({ ...report, scope: 'SQL seulement ; vérifier aussi images, Mongo et Joblib' }, null, 2));
    if (report.status !== 'sql_clear') process.exitCode = 2;
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
}
if (require.main === module) main().catch(() => {
  console.error('Vérification impossible : ne pas rouvrir la sauvegarde.');
  process.exitCode = 1;
});
