jest.mock('../config/db', () => ({ sequelize: {
  transaction: jest.fn(), query: jest.fn()
} }));
jest.mock('../models/utilisateur', () => ({ findByPk: jest.fn() }));
jest.mock('../models/vetement', () => ({ destroy: jest.fn(), findAll: jest.fn() }));
jest.mock('../models/photo', () => ({ deleteMany: jest.fn() }));
jest.mock('../models/log', () => ({ deleteMany: jest.fn() }));
jest.mock('../services/mlClient', () => ({ postToMl: jest.fn() }));

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

describe('Suppression de compte entre stockages, sans base réelle', () => {
  let root;
  let uploads;
  let deletion;
  let sequelize;
  let Utilisateur;
  let Vetement;
  let Photo;
  let Log;
  let postToMl;
  let user;
  let transaction;
  let originalUploadDir;
  let originalDeletionDir;
  const ownedName = 'u1_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg';
  const otherName = 'u2_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.jpg';
  const legacyName = 'cccccccc-cccc-cccc-cccc-cccccccccccc.png';
  const timestampLegacyName = '1760961600000-abcde.jpg';
  const retiredName = 'u1_dddddddd-dddd-dddd-dddd-dddddddddddd.jpg';

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'fits-account-delete-'));
    uploads = path.join(root, 'uploads');
    await fs.mkdir(uploads);
    originalUploadDir = process.env.FITS_UPLOAD_DIR;
    originalDeletionDir = process.env.FITS_DELETION_DIR;
    process.env.FITS_UPLOAD_DIR = uploads;
    process.env.FITS_DELETION_DIR = path.join(root, 'jobs');
    jest.resetModules();
    deletion = require('../services/accountDeletion');
    ({ sequelize } = require('../config/db'));
    Utilisateur = require('../models/utilisateur');
    Vetement = require('../models/vetement');
    Photo = require('../models/photo');
    Log = require('../models/log');
    ({ postToMl } = require('../services/mlClient'));

    user = { destroy: jest.fn().mockResolvedValue(undefined) };
    transaction = { LOCK: { UPDATE: 'UPDATE' }, finished: false,
      commit: jest.fn(async function commit() { this.finished = 'commit'; }),
      rollback: jest.fn(async function rollback() { this.finished = 'rollback'; }) };
    sequelize.transaction.mockResolvedValue(transaction);
    sequelize.query.mockResolvedValue([
      { id_vetement: 10, photo: `http://192.168.1.181:3002/uploads/${legacyName}` },
      { id_vetement: 11, photo: `http://192.168.1.181:3002/uploads/${timestampLegacyName}` },
      // Plus aucun lien contenir/composer : retrouvé par vetement.id_utilisateur.
      { id_vetement: 12, photo: `/uploads/${retiredName}` }
    ]);
    Utilisateur.findByPk.mockImplementation(async (id, options) => options ? user : null);
    Vetement.destroy.mockResolvedValue(1);
    Vetement.findAll.mockResolvedValue([]);
    Photo.deleteMany.mockResolvedValue({ deletedCount: 1 });
    Log.deleteMany.mockResolvedValue({ deletedCount: 1 });
    postToMl.mockResolvedValue({ data: { status: 'deleted' } });
    await Promise.all([ownedName, otherName, legacyName, timestampLegacyName, retiredName].map(name =>
      fs.writeFile(path.join(uploads, name), name)));
  });

  afterEach(async () => {
    if (originalUploadDir === undefined) delete process.env.FITS_UPLOAD_DIR;
    else process.env.FITS_UPLOAD_DIR = originalUploadDir;
    if (originalDeletionDir === undefined) delete process.env.FITS_DELETION_DIR;
    else process.env.FITS_DELETION_DIR = originalDeletionDir;
    await fs.rm(root, { recursive: true, force: true });
  });

  test('supprime les ressources du compte et conserve les images d’un autre compte', async () => {
    const result = await deletion.deleteAccount(1);
    expect(result.status).toBe(200);
    expect(user.destroy).toHaveBeenCalledWith({ transaction });
    expect(Vetement.destroy).toHaveBeenCalledWith(expect.objectContaining({ transaction }));
    expect(sequelize.query.mock.calls[0][0]).toContain('v.id_utilisateur = :userId');
    expect(Photo.deleteMany).toHaveBeenCalledWith({ ownerUserId: 1 });
    expect(Log.deleteMany).toHaveBeenCalledWith({ userId: '1' });
    expect(postToMl).toHaveBeenCalledWith('delete-model', {}, 1, { timeout: 5000 });
    expect(await fs.readdir(uploads)).toEqual([otherName]);
    const receipt = JSON.parse(await fs.readFile(path.join(root, 'jobs/receipts/user_1.json'), 'utf8'));
    expect(receipt.files).toContain(timestampLegacyName);
    expect(receipt.files).toContain(retiredName);
    await expect(fs.access(deletion.jobPath(1))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('un échec SQL annule la suppression et conserve les ressources annexes', async () => {
    user.destroy.mockRejectedValue(new Error('échec SQL'));
    await expect(deletion.deleteAccount(1)).rejects.toThrow('échec SQL');
    expect(transaction.rollback).toHaveBeenCalled();
    expect(Photo.deleteMany).not.toHaveBeenCalled();
    expect(postToMl).not.toHaveBeenCalled();
    expect(await fs.readdir(uploads)).toHaveLength(5);
    await expect(fs.access(deletion.jobPath(1))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('un échec ML laisse un nettoyage durable et rejouable', async () => {
    postToMl.mockRejectedValueOnce(new Error('service indisponible'));
    const result = await deletion.deleteAccount(1);
    expect(result.status).toBe(202);
    expect(JSON.parse(await fs.readFile(deletion.jobPath(1), 'utf8')).userId).toBe(1);
    expect(await deletion.retryPendingCleanup()).toEqual([{ userId: 1, complete: true,
      pending: [] }]);
    await expect(fs.access(deletion.jobPath(1))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('un manifeste écrit avant rollback ne nettoie jamais un compte encore présent', async () => {
    await fs.mkdir(path.dirname(deletion.jobPath(1)), { recursive: true });
    await fs.writeFile(deletion.jobPath(1), JSON.stringify({ version: 1, userId: 1,
      files: [ownedName] }));
    Utilisateur.findByPk.mockResolvedValue(user);
    expect(await deletion.retryPendingCleanup()).toEqual([{ userId: 1, complete: false,
      reason: 'account_exists' }]);
    expect(Photo.deleteMany).not.toHaveBeenCalled();
    expect(postToMl).not.toHaveBeenCalled();
    expect(await fs.readdir(uploads)).toHaveLength(5);
  });

  test('une image encore référencée par un autre vêtement est préservée', async () => {
    Vetement.findAll.mockResolvedValue([{ photo: `http://localhost:3002/uploads/${legacyName}` }]);
    const result = await deletion.deleteAccount(1);
    expect(result.status).toBe(202);
    expect(await fs.readFile(path.join(uploads, legacyName), 'utf8')).toBe(legacyName);
    expect((await deletion.retryCleanup(1)).pending).toContain('image_partagee');
  });

  test('refuse un identifiant non fiable avant toute opération', async () => {
    await expect(deletion.deleteAccount('../2')).rejects.toMatchObject({ status: 400 });
    expect(sequelize.transaction).not.toHaveBeenCalled();
    expect(deletion.uploadFilename('https://example.org/uploads/' + legacyName)).toBeNull();
  });
});
