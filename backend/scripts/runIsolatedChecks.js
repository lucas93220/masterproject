// macOS : vrai PostgreSQL + FastAPI, données fictives, répertoires générés sous /private/tmp.
// Aucun .env lu, aucune connexion au serveur PostgreSQL ou MongoDB de l'application.
const fs = require('node:fs/promises');
const syncFs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const net = require('node:net');
const { MongoClient } = require('mongoose').mongo;

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || !child.pid) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
  await exited;
  clearTimeout(timer);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length && !(args.length === 2 && args[0] === '--benchmark-report')) {
    throw new Error('Usage: node scripts/runIsolatedChecks.js [--benchmark-report fichier.json]');
  }
  const root = await fs.mkdtemp('/private/tmp/fits-isolated-');
  const data = path.join(root, 'pgdata');
  const backend = path.resolve(__dirname, '..');
  let started = false, ml, interactionMl, mongo, log, interactionLog;
  const run = (name, arguments_) => execFileSync(name, arguments_, { encoding: 'utf8',
    timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await fs.writeFile(path.join(root, 'ISOLATED_TEST_ONLY'), 'fits-test-v1', { mode: 0o600 });
    run('initdb', ['-D', data, '-U', 'fits_test', '--auth-local=trust', '--auth-host=reject',
      '--no-locale', '--encoding=UTF8']);
    run('pg_ctl', ['-D', data, '-l', path.join(root, 'postgres.log'), '-o',
      `-k ${root} -p 55439 -h ''`, '-w', 'start']);
    started = true;
    const bootstrap = new Client({ host: root, port: 55439, user: 'fits_test', database: 'postgres' });
    await bootstrap.connect();
    try { await bootstrap.query('CREATE DATABASE fits_isolated'); }
    finally { await bootstrap.end(); }

    process.env.FITS_ISOLATED_ROOT = root;
    const { isolatedClient } = require('../tests/helpers/isolatedDatabase');
    const client = await isolatedClient();
    try { await client.query(await fs.readFile(path.join(backend, 'tests/fixtures/schema.sql'), 'utf8')); }
    finally { await client.end(); }

    const testEnv = { ...process.env, NODE_ENV: 'test', FITS_WARDROBE_V3: '0',
      DB_HOST: root, DB_PORT: '55439', DB_NAME: 'fits_isolated', DB_USER: 'fits_test', DB_PASSWORD: '',
      MONGO_URI: '', ML_SERVICE_SECRET: randomUUID(), JWT_SECRET: randomUUID(),
      ML_MODELS_DIR: path.join(root, 'models'),
      ML_EXPERIMENTAL_MODELS_DIR: path.join(root, 'interactions'),
      FITS_UPLOAD_DIR: path.join(root, 'uploads'),
      FITS_DELETION_DIR: path.join(root, 'jobs'), ML_MIN_TRAIN_SAMPLES: '20',
      ML_MIN_SAMPLES_PER_CLASS: '5', PYTHONDONTWRITEBYTECODE: '1' };
    const mongoDir = path.join(root, 'mongo');
    await fs.mkdir(mongoDir, { mode: 0o700 });
    const mongoPort = await freePort();
    testEnv.FITS_TEST_MONGO_URL = `mongodb://127.0.0.1:${mongoPort}/fits_isolated`;
    mongo = spawn(process.env.FITS_TEST_MONGOD || 'mongod', ['--dbpath', mongoDir,
      '--bind_ip', '127.0.0.1', '--port', String(mongoPort), '--nounixsocket',
      '--logpath', path.join(root, 'mongo.log'),
      '--setParameter', 'diagnosticDataCollectionEnabled=false'], { stdio: 'ignore' });
    let mongoError;
    mongo.on('error', error => { mongoError = error; });
    let mongoReady = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (mongoError || mongo.exitCode !== null) {
        throw new Error('MongoDB de test indisponible : définir FITS_TEST_MONGOD vers le binaire mongod');
      }
      const check = new MongoClient(testEnv.FITS_TEST_MONGO_URL, { serverSelectionTimeoutMS: 300 });
      try {
        await check.connect();
        const options = await check.db('admin').command({ getCmdLineOpts: 1 });
        if (options.parsed.storage.dbPath !== mongoDir) throw new Error('MongoDB non isolé');
        mongoReady = true;
      } catch { /* uniquement le port créé pour ce processus */ }
      finally { await check.close(); }
      if (mongoReady) break;
    }
    if (!mongoReady) throw new Error('Délai de démarrage MongoDB isolé dépassé');
    log = syncFs.openSync(path.join(root, 'ml.log'), 'w');
    ml = spawn(process.env.ML_TEST_PYTHON || 'python3',
      [path.join(backend, 'tests/helpers/serve_test_ml.py')], {
        env: { ...testEnv, FITS_TEST_ML_KIND: 'reference' }, stdio: ['ignore', log, log] });
    interactionLog = syncFs.openSync(path.join(root, 'interactions.log'), 'w');
    interactionMl = spawn(process.env.ML_TEST_PYTHON || 'python3',
      [path.join(backend, 'tests/helpers/serve_test_ml.py')], {
        env: { ...testEnv, FITS_TEST_ML_KIND: 'interactions' },
        stdio: ['ignore', interactionLog, interactionLog] });
    let startupError;
    ml.on('error', error => { startupError = error; });
    interactionMl.on('error', error => { startupError = error; });
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (startupError || ml.exitCode !== null || interactionMl.exitCode !== null) {
        throw new Error('Démarrage Python isolé impossible');
      }
      try {
        const referencePort = Number(await fs.readFile(path.join(root, 'ml-reference-port'), 'utf8'));
        const interactionPort = Number(await fs.readFile(path.join(root, 'ml-interactions-port'), 'utf8'));
        if (![referencePort, interactionPort].every(port => Number.isInteger(port) && port > 0 && port <= 65535) ||
            referencePort === interactionPort) throw new Error('Ports ML invalides');
        testEnv.ML_SERVICE_URL = `http://127.0.0.1:${referencePort}`;
        testEnv.ML_EXPERIMENTAL_URL = `http://127.0.0.1:${interactionPort}`;
        ready = (await Promise.all([testEnv.ML_SERVICE_URL, testEnv.ML_EXPERIMENTAL_URL]
          .map(url => fetch(`${url}/openapi.json`, { signal: AbortSignal.timeout(500) }))))
          .every(response => response.ok);
        if (ready) break;
      } catch { /* attente bornée du processus créé par ce script */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!ready) throw new Error('Le service de test ne répond pas');
    console.log('PostgreSQL, MongoDB et deux services ML temporaires prêts. Aucune base applicative utilisée.');
    execFileSync(process.execPath, [path.join(backend, 'node_modules/jest/bin/jest.js'),
      '--runInBand', '--config', JSON.stringify({ rootDir: backend,
        testMatch: ['**/tests/isolated/*.test.js'], testTimeout: 30000 })],
    { cwd: backend, env: testEnv, stdio: 'inherit', timeout: 180000 });

    if (args[0] === '--benchmark-report') {
      const { benchmark } = require('./benchmarkIsolatedStorage');
      const report = await benchmark();
      await fs.writeFile(path.resolve(args[1]), JSON.stringify(report, null, 2) + '\n',
        { flag: 'wx' });
      console.log('Rapport de benchmark synthétique enregistré.');
    }
  } finally {
    await stopChild(ml);
    await stopChild(interactionMl);
    await stopChild(mongo);
    if (log !== undefined) syncFs.closeSync(log);
    if (interactionLog !== undefined) syncFs.closeSync(interactionLog);
    if (started) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
    // root est toujours créé par mkdtemp ci-dessus, jamais fourni par l'utilisateur.
    await fs.rm(root, { recursive: true, force: true });
    console.log('Services temporaires arrêtés et fixtures supprimées.');
  }
}
if (require.main === module) main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
