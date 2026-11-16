const Notification = require('../models/Notification');
const Group = require('../models/Group');

/**
 * Create a single notification for a user
 */
const createNotification = async ({ userId, groupId, type, message }) => {
  try {
    return await Notification.create({
      userId,
      groupId,
      type,
      message,
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
};

/**
 * Notify all members of a group except a specific user (e.g. the actor)
 */
const notifyGroupMembers = async ({ groupId, excludeUserId, type, message }) => {
  try {
    const group = await Group.findById(groupId);
    if (!group) return;

    const notifications = group.members
      .map((m) => (m.user ? m.user.toString() : null))
      .filter((uId) => uId && (!excludeUserId || uId !== excludeUserId.toString()))
      .map((userId) => ({
        userId,
        groupId,
        type,
        message,
      }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }
  } catch (error) {
    console.error('Failed to notify group members:', error);
  }
};

module.exports = {
  createNotification,
  notifyGroupMembers,
};
