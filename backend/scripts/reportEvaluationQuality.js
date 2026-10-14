// Rapport agrégé en lecture seule ; aucune donnée personnelle ou ligne d'avis affichée.
const path = require('node:path');
const { Client } = require('pg');

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  if (!['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST) ||
      process.env.DB_NAME !== 'fits' || process.env.NODE_ENV === 'production') {
    throw new Error('Rapport réservé à la base de développement fits en local.');
  }

  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });
  await client.connect();
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    const identity = await client.query(
      'SELECT current_database() AS database, host(inet_server_addr()) AS address'
    );
    if (identity.rows[0]?.database !== 'fits' ||
        !['127.0.0.1', '::1'].includes(identity.rows[0]?.address)) {
      throw new Error('Le serveur PostgreSQL ne correspond pas à la base locale attendue.');
    }
    const result = await client.query(`
      SELECT
        count(*)::int AS avis,
        count(*) FILTER (WHERE e.is_liked = true)::int AS likes,
        count(*) FILTER (WHERE e.is_liked = false)::int AS dislikes,
        count(DISTINCT e.id_utilisateur)::int AS utilisateurs_avec_avis,
        count(*) FILTER (WHERE e.temperature IS NULL)::int AS temperatures_absentes,
        count(*) FILTER (WHERE t.id_tenue IS NULL OR
          t.id_utilisateur <> e.id_utilisateur)::int AS tenues_absentes_ou_etrangeres,
        count(*) FILTER (WHERE e.temperature IS NOT NULL AND
          t.temperature IS DISTINCT FROM e.temperature)::int AS temperatures_divergentes,
        count(*) FILTER (WHERE e.feature_snapshot IS NULL)::int AS snapshots_absents,
        count(*) FILTER (WHERE e.feature_snapshot IS NOT NULL AND
          e.feature_snapshot ->> 'version' IN ('1', '2') AND
          CASE WHEN jsonb_typeof(e.feature_snapshot -> 'garments') = 'array'
            THEN jsonb_array_length(e.feature_snapshot -> 'garments') > 0
            ELSE false END)::int AS snapshots_valides,
        count(*) FILTER (WHERE e.feature_snapshot ->> 'version' = '2')::int
          AS snapshots_version_2
      FROM evaluation e
      LEFT JOIN tenue t ON t.id_tenue = e.id_tenue
    `);
    console.log(JSON.stringify({ source: 'PostgreSQL local fits, lecture seule',
      ...result.rows[0] }, null, 2));
    await client.query('ROLLBACK');
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { main };
