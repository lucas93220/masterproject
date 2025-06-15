const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  userId: { type: String }, 
  action: { type: String, required: true }, 
  details: { type: Object },
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Log', logSchema);
