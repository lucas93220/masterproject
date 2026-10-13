const Photo = require('../models/photo');
const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');
const { imageType } = require('../middlewares/imageUpload');

exports.upload = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Aucun fichier envoyé" });
    const type = imageType(req.file);
    if (!type) return res.status(415).json({ message: 'Format image non pris en charge' });
    const photo = await Photo.create({
      ownerUserId: req.user.id,
      filename: `${randomUUID()}${type.extension}`,
      data: req.file.buffer,
      contentType: type.contentType
    });
    res.status(201).json({ id: photo._id });
  } catch (error) {
    next(error);
  }
};

exports.getPhoto = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Identifiant image invalide' });
    }
    const photo = await Photo.findOne({ _id: req.params.id, ownerUserId: req.user.id });
    if (!photo) return res.status(404).json({ message: "Image non trouvée" });
    if (photo.ownerUserId !== req.user.id) {
      return res.status(404).json({ message: "Image non trouvée" });
    }
    if (!imageType({ buffer: photo.data, mimetype: photo.contentType })) {
      return res.status(415).json({ message: 'Format image non pris en charge' });
    }
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Type', photo.contentType);
    res.send(photo.data);
  } catch (error) {
    next(error);
  }
};
