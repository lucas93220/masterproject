const { recognizeClothing } = require('./clothingRecognition');
const { prepareVisualSearchBuffer } = require('./prepareVisualSearchImage');
const { searchVisualMatches } = require('./visualSearchTrial');
const { performance } = require('node:perf_hooks');

async function identifyClothing(file, catalog) {
  let visualSearch = { status: 'disabled', matches: [] };
  let analysisFile = file;
  const started = performance.now();
  const timings = { preparation_ms: 0, recherche_ms: 0, gemini_ms: 0 };
  const timed = async (name, task) => {
    const start = performance.now();
    try { return await task(); }
    finally { timings[name] = Math.round(performance.now() - start); }
  };
  try {
    if (process.env.CLOTHING_VISUAL_SEARCH !== '0' && process.env.SERPAPI_API_KEY?.trim()) {
      // Budget global (compression + upload + recherche) ; une panne ne bloque pas Gemini.
      const signal = AbortSignal.timeout(20000);
      try {
        const prepared = await timed('preparation_ms', () => prepareVisualSearchBuffer(file.buffer, { signal }));
        // Réutiliser la copie déjà créée pour éviter un second envoi de l’original lourd.
        if (prepared.compressed) analysisFile = { ...file, buffer: prepared.buffer, mimetype: 'image/jpeg', size: prepared.buffer.length };
        const result = await timed('recherche_ms', () => searchVisualMatches(prepared.buffer, { apiKey: process.env.SERPAPI_API_KEY, signal }));
        visualSearch = { status: result.status, matches: result.matches };
      } catch {
        visualSearch = { status: 'unavailable', matches: [] };
      }
    }
    const suggestion = await timed('gemini_ms', () => recognizeClothing(analysisFile, catalog, { visualMatches: visualSearch.matches }));
    // Les correspondances servent à l'analyse, sans liste ni liens dans le mobile.
    return { suggestion, visual_search: { status: visualSearch.status } };
  } finally {
    // Durées uniquement : aucune photo, identité, marque, URL ou clé dans les logs.
    console.info('[FITS Photo]', { ...timings, total_ms: Math.round(performance.now() - started) });
  }
}

module.exports = { identifyClothing };
