const log = require('../models/log');

exports.logAction = async ({ userId, action, details }) => {
  try {
    await log.create({
      userId: userId?.toString(), 
      action,
      details
    });
  } catch (err) {
    console.error("Log MongoDB failed:", err);
  }
};
