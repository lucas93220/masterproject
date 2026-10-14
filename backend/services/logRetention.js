const DEFAULT_DAYS = 30;
function retentionCutoff(now, days = DEFAULT_DAYS) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()) ||
      !Number.isInteger(days) || days < 1 || days > 365) {
    throw new Error('Date ou durée de conservation invalide');
  }
  return new Date(now.getTime() - days * 86400000);
}

async function retainLogs(Log, { now = new Date(), days = DEFAULT_DAYS, apply = false } = {}) {
  const cutoff = retentionCutoff(now, days);
  const filter = { date: { $type: 'date', $lt: cutoff } };
  const eligible = await Log.countDocuments(filter).maxTimeMS(5000);
  const undated = await Log.countDocuments({ $nor: [{ date: { $type: 'date' } }] }).maxTimeMS(5000);
  const deleted = apply ? (await Log.deleteMany(filter).maxTimeMS(5000)).deletedCount : 0;
  return { mode: apply ? 'apply' : 'dry_run', days, cutoff: cutoff.toISOString(),
    eligible, deleted, undated };
}
module.exports = { retainLogs, retentionCutoff };
