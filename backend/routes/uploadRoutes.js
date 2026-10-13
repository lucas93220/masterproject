const express = require("express");
const router = express.Router();
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const auth = require('../middlewares/auth');
const { singleImage, imageType } = require('../middlewares/imageUpload');

const uploadDir = path.resolve(process.env.FITS_UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));

router.post("/", auth, singleImage('image'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ message: 'Aucune image envoyée' });
  if (!Number.isSafeInteger(req.user.id) || req.user.id <= 0 || req.user.id > 2147483647) {
    return res.status(400).json({ message: 'Identifiant utilisateur invalide' });
  }
  const type = imageType(req.file);
  if (!type) return res.status(415).json({ message: 'Format image non pris en charge' });

  try {
    const filename = `u${req.user.id}_${randomUUID()}${type.extension}`;
    await fs.mkdir(uploadDir, { recursive: true, mode: 0o700 });
    await fs.writeFile(path.join(uploadDir, filename), req.file.buffer,
      { flag: 'wx', mode: 0o600 });
    return res.json({
      imageUrl: `${req.protocol}://${req.get('host')}/uploads/${filename}`
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
