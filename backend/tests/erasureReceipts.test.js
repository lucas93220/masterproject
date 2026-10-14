const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { readErasureReceipts, checkRestoredAccounts } = require('../services/erasureReceipts');
test('détecte la résurrection d’un compte effacé sans rien supprimer', async () => {
  const db = { query: jest.fn().mockResolvedValue({ rows: [{ n: 1 }] }) };
  expect(await checkRestoredAccounts(db, [{ userId: 1 }])).toEqual({
    receipts: 1, restored_accounts: 1, status: 'blocked'
  });
  expect(db.query).toHaveBeenCalledTimes(1);
  expect(db.query.mock.calls[0][0]).toMatch(/^SELECT/);
  expect(await checkRestoredAccounts(db, [])).toMatchObject({ status: 'no_receipts' });
});
test('un reçu invalide ou symbolique bloque le contrôle de restauration', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fits-receipt-test-'));
  try {
    const file = path.join(dir, 'user_1.json');
    await fs.writeFile(file, JSON.stringify({ version: 1, userId: 2, files: [], deletedAt: '2026-10-13' }));
    await expect(readErasureReceipts(dir)).rejects.toThrow('invalide');
    await fs.unlink(file);
    await fs.symlink(path.join(dir, 'missing'), file);
    await expect(readErasureReceipts(dir)).rejects.toThrow('symbolique');
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
