const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema({
  filename: String,
  data: Buffer,
  contentType: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Photo', photoSchema);
