const { performance } = require('node:perf_hooks');
const { isolatedClient } = require('../tests/helpers/isolatedDatabase');
const { median, planNodes } = require('./diagnosePostgres');

async function measure(client, sql) {
  await client.query(sql, [42]); // chauffe identique, hors résultat
  const times = [];
  let plan;
  for (let i = 0; i < 9; i++) {
    const result = await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`, [42]);
    plan = result.rows[0]['QUERY PLAN'][0];
    times.push(plan['Execution Time']);
  }
  return { repetitions: times.length, median_ms: median(times), min_ms: Math.min(...times),
    max_ms: Math.max(...times), samples_ms: times, rows: plan.Plan['Actual Rows'],
    shared_hit_blocks: plan.Plan['Shared Hit Blocks'], shared_read_blocks: plan.Plan['Shared Read Blocks'],
    nodes: planNodes(plan.Plan) };
}

async function benchmark() {
  const client = await isolatedClient(); // refus si le data_directory n'est pas celui créé pour les tests
  try {
    await client.query("SET statement_timeout = '20s'");
    const version = (await client.query('SHOW server_version')).rows[0].server_version;
    const cases = [];
    for (const size of [1000, 10000, 100000]) {
      await client.query('TRUNCATE utilisateur RESTART IDENTITY CASCADE');
      await client.query(`INSERT INTO utilisateur(nom,prenom,email,password,role)
        SELECT 'Fictif','Benchmark','benchmark-'||n||'@example.invalid','inutilisable','user'
        FROM generate_series(1,100) n`);
      await client.query(`INSERT INTO tenue(id_utilisateur,temperature)
        SELECT ((n-1)%100)+1,18 FROM generate_series(1,$1::int) n`, [size]);
      await client.query(`INSERT INTO evaluation(id_utilisateur,id_tenue,is_liked,temperature)
        SELECT id_utilisateur,id_tenue,id_tenue%3<>0,18 FROM tenue`);
      await client.query('ANALYZE tenue; ANALYZE evaluation');
      const sql = 'SELECT id_tenue, temperature FROM tenue WHERE id_utilisateur = $1';
      const before = await measure(client, sql);
      const started = performance.now();
      await client.query('CREATE INDEX isolated_tenue_user_idx ON tenue(id_utilisateur)');
      const indexBuildMs = performance.now() - started;
      await client.query('ANALYZE tenue');
      const after = await measure(client, sql);
      const bytes = Number((await client.query("SELECT pg_relation_size('isolated_tenue_user_idx') AS bytes")).rows[0].bytes);
      const existingEvaluationKey = await measure(client,
        'SELECT id_tenue,is_liked,temperature FROM evaluation WHERE id_utilisateur = $1');
      cases.push({ outfits: size, users: 100, selectivity: 0.01, before, after,
        index_bytes: bytes, index_build_ms: indexBuildMs, existing_evaluation_key: existingEvaluationKey });
      await client.query('DROP INDEX isolated_tenue_user_idx');
    }
    return { measured_at_utc: new Date().toISOString(), source: 'SYNTHETIC_ISOLATED_POSTGRESQL',
      server_version: version, workload: 'Lectures SQL seules ; cache chauffé ; 100 comptes fictifs uniformes',
      limits: ['Aucune donnée réelle, aucun score ML', 'Hors HTTP, ORM, entraînement et contention',
        'Pas de preuve de gain à la taille actuelle', 'Coût des écritures avec index non mesuré',
        'Les neuf mesures répétées ne sont pas des essais indépendants'], cases };
  } finally { await client.end(); }
}
module.exports = { benchmark, measure };
