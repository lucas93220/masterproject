// Diagnostic PostgreSQL local : SELECT et EXPLAIN ANALYZE sur SELECT uniquement.
const path = require('node:path');
const { Client } = require('pg');

const TABLES = ['utilisateur', 'dressing', 'contenir', 'vetement', 'categorie',
  'sous_categorie', 'zone', 'tenue', 'composer', 'evaluation'];
const REPETITIONS = 5;

function assertLocalDevelopment(env) {
  if (!['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST) ||
      env.DB_NAME !== 'fits' || env.NODE_ENV === 'production') {
    throw new Error('Diagnostic réservé à PostgreSQL local, base fits hors production.');
  }
}

function planNodes(plan, found = []) {
  found.push({ type: plan['Node Type'], table: plan['Relation Name'] || null,
    index: plan['Index Name'] || null });
  for (const child of plan.Plans || []) planNodes(child, found);
  return found;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

async function explainRead(client, sql, parameters) {
  if (!/^SELECT\s/i.test(sql)) throw new Error('EXPLAIN limité aux SELECT');
  const times = [];
  let nodes;
  for (let i = 0; i < REPETITIONS; i += 1) {
    const result = await client.query(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`, parameters);
    const explanation = result.rows[0]['QUERY PLAN'][0];
    times.push(explanation['Execution Time']);
    nodes = planNodes(explanation.Plan);
  }
  return { repetitions: REPETITIONS, execution_ms: { min: Math.min(...times),
    median: median(times), max: Math.max(...times) }, plan_nodes: nodes };
}

async function inspect(client) {
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    await client.query("SET LOCAL statement_timeout = '2s'");
    await client.query("SET LOCAL lock_timeout = '500ms'");
    const identity = (await client.query(`SELECT current_database() AS database,
      host(inet_server_addr()) AS address, current_setting('server_version') AS version,
      pg_database_size(current_database())::bigint AS database_bytes`)).rows[0];
    if (identity.database !== 'fits' || !['127.0.0.1', '::1'].includes(identity.address)) {
      throw new Error('La connexion PostgreSQL ne correspond pas au serveur local attendu.');
    }

    const tables = [];
    for (const table of TABLES) {
      const count = (await client.query(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n;
      const sizes = (await client.query(`SELECT pg_relation_size($1::regclass)::bigint AS heap,
        pg_indexes_size($1::regclass)::bigint AS indexes,
        pg_total_relation_size($1::regclass)::bigint AS total`, [table])).rows[0];
      tables.push({ table, rows: count, heap_bytes: Number(sizes.heap),
        index_bytes: Number(sizes.indexes), total_bytes: Number(sizes.total) });
    }

    const constraints = (await client.query(`SELECT cl.relname AS table_name,
      c.conname AS name, c.contype AS type, pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      WHERE n.nspname = 'public' AND cl.relname = ANY($1::text[])
      ORDER BY cl.relname, c.contype, c.conname`, [TABLES])).rows;
    const indexes = (await client.query(`SELECT tablename AS table_name, indexname AS name,
      indexdef AS definition FROM pg_indexes WHERE schemaname = 'public'
      AND tablename = ANY($1::text[]) ORDER BY tablename, indexname`, [TABLES])).rows;
    const columns = (await client.query(`SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns WHERE table_schema = 'public'
      AND table_name = ANY($1::text[]) ORDER BY table_name, ordinal_position`, [TABLES])).rows;
    const activity = {};
    for (const [name, table, column] of [
      ['generated_outfits', 'tenue', 'date_tenue'],
      ['evaluations', 'evaluation', 'date_avis']
    ]) {
      activity[name] = (await client.query(`WITH daily AS (
        SELECT ${column}::date AS day, count(*)::int AS n FROM ${table}
        WHERE ${column} IS NOT NULL GROUP BY ${column}::date
      ) SELECT count(*)::int AS active_days, min(day)::text AS first_day,
        max(day)::text AS last_day, max(n)::int AS peak_day_count FROM daily`)).rows[0];
    }

    const sampleUser = (await client.query(`SELECT id_utilisateur FROM evaluation
      GROUP BY id_utilisateur ORDER BY count(*) DESC LIMIT 1`)).rows[0]?.id_utilisateur;
    const sampleDressing = sampleUser == null ? null : (await client.query(
      'SELECT id_dressing FROM dressing WHERE id_utilisateur = $1 LIMIT 1',
      [sampleUser])).rows[0]?.id_dressing;
    const sampleOutfit = (await client.query(
      'SELECT id_tenue FROM evaluation LIMIT 1')).rows[0]?.id_tenue;
    const queries = {};
    if (sampleUser != null) {
      queries.evaluations_by_user = await explainRead(client,
        'SELECT id_tenue, is_liked, temperature, feature_snapshot FROM evaluation WHERE id_utilisateur = $1',
        [sampleUser]);
      queries.outfits_by_user = await explainRead(client,
        'SELECT id_tenue, temperature FROM tenue WHERE id_utilisateur = $1', [sampleUser]);
    }
    if (sampleDressing != null) {
      queries.dressing_by_user = await explainRead(client,
        'SELECT id_dressing FROM dressing WHERE id_utilisateur = $1 LIMIT 1', [sampleUser]);
      queries.garments_by_dressing = await explainRead(client,
        'SELECT v.id_vetement, v.temperature_min, v.temperature_max FROM contenir c JOIN vetement v ON v.id_vetement = c.id_vetement WHERE c.id_dressing = $1',
        [sampleDressing]);
    }
    if (sampleOutfit != null) {
      queries.garments_by_outfit = await explainRead(client,
        'SELECT id_vetement FROM composer WHERE id_tenue = $1', [sampleOutfit]);
    }
    return { source: 'PostgreSQL local fits, transaction READ ONLY',
      measured_at_utc: new Date().toISOString(),
      environment: { database: identity.database, server_address: identity.address,
        version: identity.version }, database_bytes: Number(identity.database_bytes),
      tables, constraints, indexes, columns, activity, queries };
  } finally {
    await client.query('ROLLBACK');
  }
}

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
  assertLocalDevelopment(process.env);
  const client = new Client({ host: process.env.DB_HOST, port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD });
  await client.connect();
  try {
    console.log(JSON.stringify(await inspect(client), null, 2));
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { assertLocalDevelopment, planNodes, median, explainRead, inspect };
