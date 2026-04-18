const express = require("express");
const router = express.Router();
const mlController = require("../controllers/mlController");
const auth = require("../middlewares/auth");

router.post("/train", auth, mlController.trainModel);

module.exports = router;