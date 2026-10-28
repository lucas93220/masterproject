// Garde-fou de coût d'un processus Node. Pour plusieurs instances, utiliser un compteur partagé.
function positive(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function createRecognitionLimit({
  perHour = positive(process.env.CLOTHING_VISION_PER_USER_HOUR, 20),
  perDay = positive(process.env.CLOTHING_VISION_GLOBAL_DAY, 200),
  concurrent = 2,
  now = Date.now
} = {}) {
  const users = new Map();
  let dayStart = now(), dayCount = 0, active = 0;
  return (req, res, next) => {
    const time = now();
    if (time - dayStart >= 86400000) { dayStart = time; dayCount = 0; }
    for (const [id, usage] of users) if (time - usage.start >= 3600000) users.delete(id);
    const usage = users.get(req.user.id) || { start: time, count: 0 };
    if (active >= concurrent || usage.count >= perHour || dayCount >= perDay) {
      const delay = dayCount >= perDay ? Math.ceil((dayStart + 86400000 - time) / 1000)
        : usage.count >= perHour ? Math.ceil((usage.start + 3600000 - time) / 1000) : 30;
      res.set('Retry-After', String(Math.max(1, delay)));
      return res.status(429).json({ message: 'Limite d’analyse photo atteinte. Réessaie plus tard ou continue manuellement.' });
    }
    usage.count += 1; dayCount += 1; active += 1;
    users.set(req.user.id, usage);
    // Garder le créneau jusqu'à la fin du traitement, même si le client se déconnecte.
    let released = false;
    res.locals.releaseRecognition = () => { if (!released) { active -= 1; released = true; } };
    next();
  };
}

module.exports = { createRecognitionLimit };
