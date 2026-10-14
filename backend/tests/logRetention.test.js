const { retainLogs, retentionCutoff } = require('../services/logRetention');
const now = new Date('2026-10-13T12:00:00Z');
const query = value => ({ maxTimeMS: jest.fn().mockResolvedValue(value) });
test('aperçu par défaut : compte les vieux journaux et les dates absentes, sans effacement', async () => {
  const Log = { countDocuments: jest.fn().mockReturnValueOnce(query(8)).mockReturnValueOnce(query(2)),
    deleteMany: jest.fn() };
  expect(await retainLogs(Log, { now })).toEqual({ mode: 'dry_run', days: 30,
    cutoff: '2026-09-13T12:00:00.000Z', eligible: 8, deleted: 0, undated: 2 });
  expect(Log.deleteMany).not.toHaveBeenCalled();
});
test('application explicite : efface seulement les dates antérieures au seuil fixé', async () => {
  const Log = { countDocuments: jest.fn().mockReturnValue(query(8)),
    deleteMany: jest.fn().mockReturnValue(query({ deletedCount: 8 })) };
  const result = await retainLogs(Log, { now, apply: true });
  expect(result.deleted).toBe(8);
  expect(Log.deleteMany).toHaveBeenCalledWith({ date: { $type: 'date',
    $lt: new Date('2026-09-13T12:00:00Z') } });
});
test.each([0, -1, NaN, 1.5, 366])('durée invalide %p : aucune requête', days => {
  expect(() => retentionCutoff(now, days)).toThrow('Date ou durée');
});
