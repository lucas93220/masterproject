const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

function isolatedConfig() {
  const root = process.env.FITS_ISOLATED_ROOT;
  if (!root || !/^\/private\/tmp\/fits-isolated-[a-zA-Z0-9]+$/.test(root) ||
      fs.readFileSync(path.join(root, 'ISOLATED_TEST_ONLY'), 'utf8') !== 'fits-test-v1') {
    throw new Error('Utiliser scripts/runIsolatedChecks.js : cluster temporaire obligatoire');
  }
  return { host: root, port: 55439, user: 'fits_test', database: 'fits_isolated',
    connectionTimeoutMillis: 3000 };
}

async function assertIsolated(client) {
  const config = isolatedConfig();
  const { rows: [identity] } = await client.query(`SELECT current_database() AS database,
    current_setting('data_directory') AS directory, inet_server_addr() AS address`);
  if (identity.database !== config.database || identity.address !== null ||
      fs.realpathSync(identity.directory) !== path.join(config.host, 'pgdata')) {
    throw new Error('Refus d’écriture : serveur non isolé');
  }
}

async function isolatedClient() {
  const client = new Client(isolatedConfig());
  await client.connect();
  try { await assertIsolated(client); return client; }
  catch (error) { await client.end(); throw error; }
}
module.exports = { isolatedConfig, isolatedClient, assertIsolated };
