const { QueryTypes } = require('sequelize');

// Ancien format horodaté sans identifiant : son accès exige la relation SQL ci-dessous.
const imageName = /^(?:(?:u([1-9]\d*)_)?[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|\d{13}-[a-z]{5})\.(?:jpe?g|png|webp)$/i;

function localImageName(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value, 'http://localhost');
    const match = /^\/uploads\/([^/]+)$/.exec(url.pathname);
    return ['http:', 'https:'].includes(url.protocol) && match && imageName.test(match[1])
      ? match[1] : null;
  } catch { return null; }
}

async function canReadImage(userId, filename) {
  const match = imageName.exec(filename);
  if (!match) return false;
  // Les nouveaux fichiers ont un propriétaire dès l'upload, avant la création du vêtement.
  if (match[1]) return Number(match[1]) === userId;
  const { sequelize } = require('../config/db');
  // Historique : accès uniquement à travers une relation métier possédée.
  const rows = await sequelize.query(`SELECT 1 FROM vetement v
    WHERE split_part(split_part(v.photo, '?', 1), '#', 1) LIKE :suffix
      AND (EXISTS (SELECT 1 FROM contenir c JOIN dressing d USING (id_dressing)
        WHERE c.id_vetement = v.id_vetement AND d.id_utilisateur = :userId)
      OR EXISTS (SELECT 1 FROM composer c JOIN tenue t USING (id_tenue)
        WHERE c.id_vetement = v.id_vetement AND t.id_utilisateur = :userId))
    LIMIT 1`, { replacements: { suffix: `%/uploads/${filename}`, userId }, type: QueryTypes.SELECT });
  return rows.length > 0;
}

async function validatePhotoAssignment(photo, userId, currentPhoto) {
  // Une ancienne référence peut rester inchangée ; une nouvelle doit provenir de l'upload du compte.
  if (photo == null || photo === '' || photo === currentPhoto) return;
  const filename = localImageName(photo);
  const owner = filename && imageName.exec(filename)?.[1];
  if (!owner || Number(owner) !== userId) {
    throw Object.assign(new Error('Utilisez une image envoyée depuis votre compte'), { status: 400 });
  }
}

module.exports = { imageName, localImageName, canReadImage, validatePhotoAssignment };
