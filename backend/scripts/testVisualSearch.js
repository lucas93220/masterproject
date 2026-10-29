const path = require('node:path');
const { searchVisualMatches } = require('../services/visualSearchTrial');
const { prepareVisualSearchImage } = require('../services/prepareVisualSearchImage');

async function main(args = process.argv.slice(2)) {
  if (args.includes('--help') || !args.length) {
    console.log('Usage : node scripts/testVisualSearch.js --image "/chemin/photo.jpg" [--send]');
    console.log('Sans --send : vérification locale. Avec --send : envoi à SerpApi/Google, selon le quota du compte.');
    console.log('JPEG/PNG/WebP : 20 Mio maximum ; compression automatique sur macOS pour respecter les 500 Ko du fournisseur.');
    return;
  }
  const index = args.indexOf('--image');
  if (index < 0 || !args[index + 1] || args[index + 1].startsWith('--') ||
      args.some((arg, i) => i !== index + 1 && !['--image', '--send'].includes(arg))) {
    throw new Error('Utilise --image "/chemin/photo.jpg" et, pour envoyer la photo, --send.');
  }
  const { buffer, compressed, originalBytes } = await prepareVisualSearchImage(args[index + 1]);
  if (compressed) console.log(`Copie compressée : ${Math.ceil(originalBytes / 1024)} → ${Math.ceil(buffer.length / 1024)} Kio. Original inchangé.`);
  if (!args.includes('--send')) {
    console.log('Photo valide. Aucun envoi effectué. Ajoute --send pour lancer une recherche réelle.');
    return;
  }
  require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
  const report = await searchVisualMatches(buffer, { apiKey: process.env.SERPAPI_API_KEY });
  console.log('Correspondances visuelles possibles — identité exacte à vérifier :');
  console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) main().catch(() => {
  // Ne pas imprimer l’exception brute, qui pourrait contenir une URL ou une clé.
  console.error('Essai interrompu : vérifie le fichier JPEG/PNG/WebP (20 Mio maximum ; compression sur macOS), SERPAPI_API_KEY, le quota et la connexion. Aucun réessai automatique.');
  process.exitCode = 1;
});
module.exports = { main };
