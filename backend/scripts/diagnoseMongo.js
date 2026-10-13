// Diagnostic MongoDB en lecture seule : métadonnées et lookup _id sans lire les images.
const path = require('node:path');
const { MongoClient } = require('mongodb');

const COLLECTIONS = ['logs', 'photos'];
const REPETITIONS = 5;

function assertTarget(uri, env) {
  if (env.NODE_ENV === 'production') throw new Error('Diagnostic interdit en mode production.');
  let parsed;
  try { parsed = new URL(uri); } catch { throw new Error('MONGO_URI invalide.'); }
  if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) ||
      decodeURIComponent(parsed.pathname.slice(1)) !== 'fits') {
    throw new Error('Diagnostic réservé à la base MongoDB fits.');
  }
  return { database: 'fits', remote: !['localhost', '127.0.0.1', '::1']
    .includes(parsed.hostname) };
}

function median(values) {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

async function inspect(db, target) {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray())
    .map(item => item.name));
  const collections = [];
  for (const name of COLLECTIONS) {
    if (!existing.has(name)) {
      collections.push({ collection: name, exists: false, documents: 0 });
      continue;
    }
    const collection = db.collection(name);
    const item = { collection: name, exists: true };
    try {
      const stats = await db.command({ collStats: name, scale: 1, maxTimeMS: 2000 });
      item.documents = stats.count;
      item.logical_bytes = stats.size;
      item.storage_bytes = stats.storageSize;
      item.index_bytes = stats.totalIndexSize;
    } catch (error) {
      item.stats_unavailable = error.codeName || error.name;
      try { item.documents_estimated = await collection.estimatedDocumentCount({ maxTimeMS: 2000 }); }
      catch (countError) { item.count_unavailable = countError.codeName || countError.name; }
    }
    try {
      item.indexes = (await collection.listIndexes({ maxTimeMS: 2000 }).toArray())
        .map(index => ({ name: index.name, key: index.key,
          unique: index.name === '_id_' || Boolean(index.unique) }));
    } catch (error) {
      item.indexes_unavailable = error.codeName || error.name;
    }
    if (name === 'photos' && (item.documents ?? item.documents_estimated) > 0) {
      const sample = await collection.findOne({}, { projection: { _id: 1 }, maxTimeMS: 1000 });
      if (sample) {
        const timings = [];
        for (let i = 0; i < REPETITIONS; i += 1) {
          const start = process.hrtime.bigint();
          await collection.findOne({ _id: sample._id },
            { projection: { _id: 1 }, maxTimeMS: 1000 });
          timings.push(Number(process.hrtime.bigint() - start) / 1e6);
        }
        item.id_lookup_only_ms = { repetitions: REPETITIONS,
          min: Math.min(...timings), median: median(timings), max: Math.max(...timings) };
      }
    }
    collections.push(item);
  }
  return { source: 'MongoDB fits, commandes de lecture seules',
    measured_at_utc: new Date().toISOString(), target,
    collections, image_bytes_read: false };
}

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
  const target = assertTarget(process.env.MONGO_URI, process.env);
  const client = new MongoClient(process.env.MONGO_URI,
    { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    console.log(JSON.stringify(await inspect(client.db(target.database), target), null, 2));
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch(error => { console.error(error.codeName || error.name); process.exitCode = 1; });
}

module.exports = { assertTarget, median, inspect };
