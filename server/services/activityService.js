const Activity = require('../models/Activity');

/**
 * Log an activity event in a group
 */
const logActivity = async ({ groupId, userId, action, description }) => {
  try {
    return await Activity.create({
      groupId,
      userId,
      action,
      description,
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
    return null;
  }
};

module.exports = {
  logActivity,
};
