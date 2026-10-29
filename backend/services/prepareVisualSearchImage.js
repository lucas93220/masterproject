const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { promisify } = require('node:util');
const execFile = promisify(require('node:child_process').execFile);
const { imageType } = require('../middlewares/imageUpload');
const { validateImage, MAX_TRIAL_BYTES } = require('./visualSearchTrial');

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

async function readSource(filename) {
  let handle;
  try {
    handle = await fs.open(path.resolve(filename), 'r');
    const stat = await handle.stat();
    if (!stat.isFile() || !stat.size || stat.size > MAX_SOURCE_BYTES) throw new Error('file');
    // Lecture bornée même si le fichier est modifié pendant sa lecture.
    const buffer = Buffer.alloc(Math.min(stat.size + 1, MAX_SOURCE_BYTES + 1));
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    if (offset > stat.size) throw new Error('changed');
    return buffer.subarray(0, offset);
  } catch {
    throw new Error('Photo locale illisible, modifiée pendant la lecture ou supérieure à 20 Mio.');
  } finally { await handle?.close(); }
}

async function prepareVisualSearchImage(filename, options = {}) {
  return prepareVisualSearchBuffer(await readSource(filename), options);
}

async function prepareVisualSearchBuffer(original, { platform = process.platform, convert = execFile, signal } = {}) {
  signal?.throwIfAborted();
  if (!Buffer.isBuffer(original) || !original.length || original.length > MAX_SOURCE_BYTES) throw new Error('Image trop volumineuse ou vide.');
  const type = ['image/jpeg', 'image/png', 'image/webp'].map(mimetype => imageType({ buffer: original, mimetype })).find(Boolean);
  if (!type) throw new Error('Format non pris en charge : JPEG, PNG ou WebP attendu.');
  if (original.length <= MAX_TRIAL_BYTES) {
    validateImage(original);
    return { buffer: original, compressed: false, originalBytes: original.length };
  }
  if (platform !== 'darwin') throw new Error('Compression automatique disponible sur macOS ; utilise une copie de 500 Ko maximum.');
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'fits-visual-image-'));
  try {
    // Le convertisseur reçoit uniquement une copie privée ; jamais l'original.
    const input = path.join(folder, `source${type.extension}`);
    const output = path.join(folder, 'search.jpg');
    await fs.writeFile(input, original, { mode: 0o600, flag: 'wx' });
    for (const [edge, quality] of [[1600, 80], [1280, 65], [960, 50], [640, 40]]) {
      signal?.throwIfAborted();
      await fs.writeFile(output, '', { mode: 0o600 });
      await convert('/usr/bin/sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(quality),
        '-Z', String(edge), input, '--out', output], { timeout: 15000, maxBuffer: 65536, ...(signal ? { signal } : {}) });
      if ((await fs.stat(output)).size > MAX_TRIAL_BYTES) continue;
      const buffer = await fs.readFile(output);
      validateImage(buffer);
      return { buffer, compressed: true, originalBytes: original.length };
    }
    throw new Error('size');
  } catch {
    throw new Error('Compression impossible : essaie une photo recadrée ou exportée en JPEG.');
  } finally { await fs.rm(folder, { recursive: true, force: true }); }
}

module.exports = { prepareVisualSearchImage, prepareVisualSearchBuffer, MAX_SOURCE_BYTES };
