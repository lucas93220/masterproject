const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const auth = require('../middlewares/auth');
const { canReadImage } = require('../services/imageAccess');

const router = express.Router();
const uploadDir = path.resolve(process.env.FITS_UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));

router.use((_req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  res.vary('Authorization');
  next();
});
router.get('/:filename', auth, async (req, res, next) => {
  try {
    const { filename } = req.params;
    if (!await canReadImage(req.user.id, filename)) return res.sendStatus(404);
    const file = path.join(uploadDir, filename);
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink()) return res.sendStatus(404);
    return res.sendFile(file, { cacheControl: false, dotfiles: 'deny' }, error => {
      if (error) next(error);
    });
  } catch (error) {
    if (error.code === 'ENOENT') return res.sendStatus(404);
    next(error);
  }
});
module.exports = router;
