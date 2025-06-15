const Photo = require('../models/photo');

exports.upload = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Aucun fichier envoyé" });
    const photo = await Photo.create({
      filename: req.file.originalname,
      data: req.file.buffer,
      contentType: req.file.mimetype
    });
    res.status(201).json({ id: photo._id });
  } catch (error) {
    next(error);
  }
};

exports.getPhoto = async (req, res, next) => {
  try {
    const photo = await Photo.findById(req.params.id);
    if (!photo) return res.status(404).json({ message: "Image non trouvée" });
    res.set('Content-Type', photo.contentType);
    res.send(photo.data);
  } catch (error) {
    next(error);
  }
};
