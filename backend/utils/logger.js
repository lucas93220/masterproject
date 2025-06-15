const Log = require('../models/log');

exports.logAction = async ({ userId, action, details }) => {
  try {
    await Log.create({
      userId: userId?.toString(), 
      action,
      details
    });
  } catch (err) {
    console.error("Log MongoDB failed:", err);
  }
};
