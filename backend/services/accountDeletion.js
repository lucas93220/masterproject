const fs = require('node:fs/promises');
const path = require('node:path');
const { Op, QueryTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Utilisateur = require('../models/utilisateur');
const Vetement = require('../models/vetement');
const Photo = require('../models/photo');
const Log = require('../models/log');
const { postToMl } = require('./mlClient');

const uploadDir = path.resolve(process.env.FITS_UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));
const jobDir = path.resolve(process.env.FITS_DELETION_DIR ||
  path.join(__dirname, '..', 'private', 'deletion-jobs'));
if (jobDir === uploadDir || jobDir.startsWith(`${uploadDir}${path.sep}`)) {
  throw new Error('Le dossier des suppressions ne doit pas être public');
}
const imageName = /^(?:u[1-9]\d*_)?[a-f0-9-]{36}\.(?:jpe?g|png|webp)$/i;

function jobPath(userId) {
  if (!Number.isSafeInteger(userId) || userId <= 0 || userId > 2147483647) {
    throw Object.assign(new Error('Identifiant utilisateur invalide'), { status: 400 });
  }
  return path.join(jobDir, `user_${userId}.json`);
}

function uploadFilename(photo) {
  if (typeof photo !== 'string') return null;
  try {
    const url = new URL(photo, 'http://localhost');
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    if (!['localhost', '127.0.0.1', '::1'].includes(host) &&
        !/^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host)) return null;
    const match = /^\/uploads\/([^/]+)$/i.exec(url.pathname);
    return match && imageName.test(match[1]) ? match[1] : null;
  } catch {
    return null;
  }
}

async function ownedGarments(userId, transaction) {
  return sequelize.query(`
    SELECT v.id_vetement, v.photo
    FROM vetement v
    WHERE (
      EXISTS (
        SELECT 1 FROM contenir own_c
        JOIN dressing own_d ON own_d.id_dressing = own_c.id_dressing
        WHERE own_c.id_vetement = v.id_vetement AND own_d.id_utilisateur = :userId
      ) OR EXISTS (
        SELECT 1 FROM composer own_co
        JOIN tenue own_t ON own_t.id_tenue = own_co.id_tenue
        WHERE own_co.id_vetement = v.id_vetement AND own_t.id_utilisateur = :userId
      )
    )
      AND NOT EXISTS (
        SELECT 1 FROM contenir other_c
        JOIN dressing other_d ON other_d.id_dressing = other_c.id_dressing
        WHERE other_c.id_vetement = v.id_vetement
          AND other_d.id_utilisateur <> :userId
      )
      AND NOT EXISTS (
        SELECT 1 FROM composer other_co
        JOIN tenue other_t ON other_t.id_tenue = other_co.id_tenue
        WHERE other_co.id_vetement = v.id_vetement
          AND other_t.id_utilisateur <> :userId
      )`, { replacements: { userId }, type: QueryTypes.SELECT, transaction });
}

async function accountFiles(userId, garments) {
  let names = [];
  try {
    names = await fs.readdir(uploadDir);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const ownedPrefix = new RegExp(`^u${userId}_[a-f0-9-]{36}\\.(?:jpe?g|png|webp)$`, 'i');
  const files = names.filter(name => ownedPrefix.test(name));
  for (const garment of garments) {
    const name = uploadFilename(garment.photo);
    if (name) files.push(name);
  }
  return [...new Set(files)];
}

async function deleteAccount(userId) {
  const manifestPath = jobPath(userId);
  const transaction = await sequelize.transaction();
  let createdJob = false;
  let commitAttempted = false;
  try {
    const user = await Utilisateur.findByPk(userId, {
      transaction, lock: transaction.LOCK.UPDATE
    });
    if (!user) {
      await transaction.rollback();
      return { status: 404, message: 'Utilisateur non trouvé' };
    }

    const garments = await ownedGarments(userId, transaction);
    const files = await accountFiles(userId, garments);
    await fs.mkdir(jobDir, { recursive: true, mode: 0o700 });
    await fs.chmod(jobDir, 0o700);
    try {
      await fs.writeFile(manifestPath, JSON.stringify({ version: 1, userId, files }),
        { flag: 'wx', mode: 0o600 });
      createdJob = true;
    } catch (error) {
      if (error.code === 'EEXIST') {
        throw Object.assign(new Error('Suppression déjà en cours'), { status: 409 });
      }
      throw error;
    }

    await user.destroy({ transaction });
    if (garments.length) {
      await Vetement.destroy({
        where: { id_vetement: { [Op.in]: garments.map(item => item.id_vetement) } },
        transaction
      });
    }
    commitAttempted = true;
    await transaction.commit();
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    if (createdJob && !commitAttempted) await fs.unlink(manifestPath).catch(() => {});
    throw error;
  }

  let result;
  try {
    result = await retryCleanup(userId);
  } catch {
    return { status: 202, message: 'Compte supprimé ; nettoyage annexe en attente de reprise.' };
  }
  return result.complete
    ? { status: 200, message: 'Compte et ressources identifiables supprimés avec succès.' }
    : { status: 202, message: 'Compte supprimé ; nettoyage annexe en attente de reprise.' };
}

async function retryCleanup(userId) {
  const manifestPath = jobPath(userId);
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  if (manifest.version !== 1 || manifest.userId !== userId ||
      !Array.isArray(manifest.files) || !manifest.files.every(name => imageName.test(name))) {
    throw new Error('Manifeste de suppression invalide');
  }
  // Le manifeste peut avoir été écrit juste avant un rollback ou un crash.
  if (await Utilisateur.findByPk(userId)) return { complete: false, reason: 'account_exists' };

  // Conserver la preuve minimale hors des sauvegardes applicatives à restaurer.
  // Elle permet de repérer un compte effacé qui réapparaîtrait après restauration.
  const receiptDir = path.join(jobDir, 'receipts');
  await fs.mkdir(receiptDir, { recursive: true, mode: 0o700 });
  try {
    await fs.writeFile(path.join(receiptDir, `user_${userId}.json`),
      JSON.stringify({ ...manifest, deletedAt: new Date().toISOString() }),
      { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }

  const pending = [];
  const operations = await Promise.allSettled([
    Photo.deleteMany({ ownerUserId: userId }),
    Log.deleteMany({ userId: String(userId) }),
    postToMl('delete-model', {}, userId, { timeout: 5000 })
  ]);
  if (operations[0].status === 'rejected') pending.push('photos_mongo');
  if (operations[1].status === 'rejected') pending.push('logs_mongo');
  if (operations[2].status === 'rejected') pending.push('modele_ml');

  let surviving = [];
  try {
    surviving = await Vetement.findAll({ attributes: ['photo'] });
  } catch {
    pending.push('references_images');
  }
  if (!pending.includes('references_images')) {
    for (const name of manifest.files) {
      // Une ancienne URL peut avoir un format inattendu ; conserver le fichier
      // dès qu'un vêtement restant contient encore son nom.
      if (surviving.some(item => typeof item.photo === 'string' && item.photo.includes(name))) {
        pending.push('image_partagee');
        continue;
      }
      try {
        await fs.unlink(path.join(uploadDir, name));
      } catch (error) {
        if (error.code !== 'ENOENT') pending.push('image_disque');
      }
    }
  }

  if (!pending.length) await fs.unlink(manifestPath);
  return { complete: pending.length === 0, pending: [...new Set(pending)] };
}

async function retryPendingCleanup() {
  let names;
  try {
    names = await fs.readdir(jobDir);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const results = [];
  for (const name of names.filter(value => /^user_[1-9]\d*\.json$/.test(value))) {
    const userId = Number(name.slice(5, -5));
    if (Number.isSafeInteger(userId)) {
      results.push({ userId, ...await retryCleanup(userId) });
    }
  }
  return results;
}

module.exports = { deleteAccount, retryCleanup, retryPendingCleanup,
  uploadFilename, accountFiles, jobPath };
