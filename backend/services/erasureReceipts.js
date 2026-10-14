const fs = require('node:fs/promises');
const path = require('node:path');
const { imageName } = require('./imageAccess');

const receiptDir = () => path.join(path.resolve(process.env.FITS_DELETION_DIR ||
  path.join(__dirname, '..', 'private', 'deletion-jobs')), 'receipts');

async function hasErasureReceipt(userId) {
  if (!Number.isSafeInteger(userId) || userId <= 0 || userId > 2147483647) return true;
  try {
    await fs.lstat(path.join(receiptDir(), `user_${userId}.json`));
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function readErasureReceipts(directory = receiptDir()) {
  let names;
  try { names = await fs.readdir(directory); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const receipts = [];
  for (const name of names.filter(name => /^user_[1-9]\d*\.json$/.test(name))) {
    const file = path.join(directory, name);
    if ((await fs.lstat(file)).isSymbolicLink()) throw new Error('Reçu symbolique refusé');
    const receipt = JSON.parse(await fs.readFile(file, 'utf8'));
    if (receipt.version !== 1 || !Number.isSafeInteger(receipt.userId) || receipt.userId <= 0 ||
        receipt.userId > 2147483647 || name !== `user_${receipt.userId}.json` ||
        !Number.isFinite(Date.parse(receipt.deletedAt)) || !Array.isArray(receipt.files) ||
        !receipt.files.every(value => typeof value === 'string' && imageName.test(value))) {
      throw new Error('Reçu de suppression invalide');
    }
    receipts.push(receipt);
  }
  return receipts;
}

// Le client est une connexion pg déjà ouverte. Cette fonction ne fait que des SELECT.
async function checkRestoredAccounts(client, receipts) {
  if (!receipts.length) return { receipts: 0, restored_accounts: 0, status: 'no_receipts' };
  const { rows } = await client.query('SELECT count(*)::int AS n FROM utilisateur WHERE id_utilisateur = ANY($1::int[])',
    [receipts.map(receipt => receipt.userId)]);
  return { receipts: receipts.length, restored_accounts: rows[0].n,
    status: rows[0].n ? 'blocked' : 'sql_clear' };
}

module.exports = { hasErasureReceipt, readErasureReceipts, checkRestoredAccounts };
