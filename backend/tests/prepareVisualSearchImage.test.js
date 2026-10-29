const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { prepareVisualSearchImage, MAX_SOURCE_BYTES } = require('../services/prepareVisualSearchImage');
const { MAX_TRIAL_BYTES } = require('../services/visualSearchTrial');
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
let folder;
beforeEach(async () => { folder = await fs.mkdtemp(path.join(os.tmpdir(), 'fits-prepare-test-')); });
afterEach(async () => { await fs.rm(folder, { recursive: true, force: true }); });
async function image(size = jpeg.length) {
  const buffer = Buffer.alloc(size); jpeg.copy(buffer);
  const file = path.join(folder, 'source.jpg');
  await fs.writeFile(file, buffer);
  return { file, buffer };
}

test('conserve exactement les petites images sans conversion', async () => {
  const { file, buffer } = await image();
  const convert = jest.fn();
  const result = await prepareVisualSearchImage(file, { convert });
  expect(result.buffer).toEqual(buffer); expect(result.compressed).toBe(false);
  expect(convert).not.toHaveBeenCalled();
});

test('compresse une copie privée, préserve l’original et nettoie les fichiers temporaires', async () => {
  const { file, buffer } = await image(MAX_TRIAL_BYTES + 1);
  let temporary;
  const convert = jest.fn(async (executable, args, options) => {
    expect(executable).toBe('/usr/bin/sips'); expect(options.timeout).toBe(15000);
    const source = args[args.indexOf('--out') - 1];
    const output = args[args.indexOf('--out') + 1]; temporary = path.dirname(output);
    expect(source).not.toBe(file); expect(await fs.readFile(source)).toEqual(buffer);
    expect((await fs.stat(source)).mode & 0o777).toBe(0o600);
    await fs.writeFile(output, jpeg);
  });
  const result = await prepareVisualSearchImage(file, { platform: 'darwin', convert });
  expect(result).toEqual({ buffer: jpeg, compressed: true, originalBytes: buffer.length });
  expect(await fs.readFile(file)).toEqual(buffer);
  await expect(fs.access(temporary)).rejects.toMatchObject({ code: 'ENOENT' });
});

test('réduit progressivement la copie quand la première compression ne suffit pas', async () => {
  const { file } = await image(MAX_TRIAL_BYTES + 1);
  const convert = jest.fn(async (exe, args) => fs.writeFile(args.at(-1),
    convert.mock.calls.length === 1 ? Buffer.alloc(MAX_TRIAL_BYTES + 1) : jpeg));
  expect((await prepareVisualSearchImage(file, { platform: 'darwin', convert })).compressed).toBe(true);
  expect(convert).toHaveBeenCalledTimes(2);
  expect(convert.mock.calls[1][1]).toEqual(expect.arrayContaining(['1280', '65']));
});

test.each(['error', 'oversize'])('nettoie après échec de conversion : %s', async failure => {
  const { file, buffer } = await image(MAX_TRIAL_BYTES + 1);
  let temporary;
  const convert = jest.fn(async (exe, args) => {
    temporary = path.dirname(args.at(-1));
    if (failure === 'error') throw new Error('chemin privé');
    await fs.writeFile(args.at(-1), Buffer.alloc(MAX_TRIAL_BYTES + 1));
  });
  await expect(prepareVisualSearchImage(file, { platform: 'darwin', convert })).rejects.toThrow('Compression impossible');
  expect(await fs.readFile(file)).toEqual(buffer);
  await expect(fs.access(temporary)).rejects.toMatchObject({ code: 'ENOENT' });
  expect(convert.mock.calls.length).toBeLessThanOrEqual(4);
});

test('rejette les sources trop grosses, non images et les dossiers avant conversion', async () => {
  const convert = jest.fn();
  const { file } = await image();
  await fs.truncate(file, MAX_SOURCE_BYTES + 1);
  await expect(prepareVisualSearchImage(file, { convert })).rejects.toThrow('20 Mio');
  await fs.writeFile(file, 'texte');
  await expect(prepareVisualSearchImage(file, { convert })).rejects.toThrow('Format');
  await expect(prepareVisualSearchImage(folder, { convert })).rejects.toThrow('illisible');
  expect(convert).not.toHaveBeenCalled();
});

test('explique la limite sur les autres systèmes sans lancer de convertisseur', async () => {
  const { file } = await image(MAX_TRIAL_BYTES + 1);
  const convert = jest.fn();
  await expect(prepareVisualSearchImage(file, { platform: 'linux', convert })).rejects.toThrow('macOS');
  expect(convert).not.toHaveBeenCalled();
});
