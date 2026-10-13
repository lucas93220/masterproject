const express = require("express");
const router = express.Router();
const multer = require("multer");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

router.post("/", upload.single("image"), (req, res) => {
  res.json({
    imageUrl: `${req.protocol}://${req.get("host")}/uploads/${encodeURIComponent(req.file.filename)}`
  });
});

module.exports = router;
