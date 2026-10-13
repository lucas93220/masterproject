const multer = require('multer');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0 }
});

function singleImage(field) {
  const middleware = upload.single(field);
  return (req, res, next) => middleware(req, res, error => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'Image trop volumineuse (5 Mio maximum)' });
    }
    return res.status(400).json({ message: 'Fichier image invalide' });
  });
}

function imageType(file) {
  if (!file?.buffer) return null;
  const bytes = file.buffer;
  if (file.mimetype === 'image/jpeg' && bytes.length >= 3 &&
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: '.jpg', contentType: 'image/jpeg' };
  }
  if (file.mimetype === 'image/png' && bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { extension: '.png', contentType: 'image/png' };
  }
  if (file.mimetype === 'image/webp' && bytes.length >= 12 &&
      bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    return { extension: '.webp', contentType: 'image/webp' };
  }
  return null;
}

function onlyImageFiles(req, res, next) {
  if (!/\.(?:jpe?g|png|webp)$/i.test(req.path)) return res.sendStatus(404);
  return next();
}

module.exports = { singleImage, imageType, onlyImageFiles, MAX_IMAGE_BYTES };
