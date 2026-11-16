const mongoose = require('mongoose');
const Group = require('../models/Group');

// Verifies that req.user is a member of the requested group
const isGroupMember = async (req, res, next) => {
  try {
    const groupId = req.params.groupId || req.body.groupId || req.query.groupId;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Group ID is required.',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Group ID format.',
      });
    }

    const group = await Group.findById(groupId).populate('members.user', 'name email profilePicture');

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found.',
      });
    }

    const userIdStr = req.user._id.toString();
    const member = group.members.find(
      (m) => (m.user._id ? m.user._id.toString() : m.user.toString()) === userIdStr
    );

    if (!member) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not a member of this group.',
      });
    }

    req.group = group;
    req.groupMember = member;
    next();
  } catch (error) {
    next(error);
  }
};

// Verifies that req.user has admin privileges in the group
const isGroupAdmin = async (req, res, next) => {
  if (!req.groupMember || req.groupMember.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only group administrators can perform this action.',
    });
  }
  next();
};

module.exports = { isGroupMember, isGroupAdmin };
