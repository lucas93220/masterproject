// Lecture seule par défaut. --apply est une opération d'administration destructive explicite.
const path = require('node:path');
const mongoose = require('mongoose');
const { retainLogs } = require('../services/logRetention');

async function main(args = process.argv.slice(2)) {
  if (args.some(arg => arg !== '--apply')) throw new Error('Usage: node scripts/retainLogs.js [--apply]');
  require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
  if (!process.env.MONGO_URI) throw new Error('Connexion MongoDB non configurée');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000, autoIndex: false });
  try {
    const report = await retainLogs(require('../models/log'), {
      days: Number(process.env.FITS_LOG_RETENTION_DAYS || 30), apply: args.includes('--apply')
    });
    console.log(JSON.stringify(report, null, 2));
  } finally { await mongoose.disconnect(); }
}
if (require.main === module) main().catch(() => {
  console.error('Rétention interrompue : vérifier la configuration et la disponibilité MongoDB.');
  process.exitCode = 1;
});
module.exports = { main };
