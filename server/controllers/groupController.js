const Group = require('../models/Group');
const User = require('../models/User');
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const Activity = require('../models/Activity');
const { calculateGroupBalances } = require('../services/calculationService');
const { createNotification } = require('../services/notificationService');
const { logActivity } = require('../services/activityService');

// @desc    Create a new group
// @route   POST /api/groups
// @access  Private
const createGroup = async (req, res, next) => {
  try {
    const { name, description, category, memberEmails } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a group name.',
      });
    }

    const validCategories = ['Trip', 'Hostel', 'Flat / Roommates', 'Family', 'Party', 'Other'];
    const groupCategory = validCategories.includes(category) ? category : 'Other';

    // Creator is always the first member and the admin
    const membersList = [
      {
        user: req.user._id,
        role: 'admin',
        joinedAt: new Date(),
      },
    ];

    const addedUserIds = new Set([req.user._id.toString()]);
    const invitedUsers = [];

    // Process additional members if supplied
    if (Array.isArray(memberEmails) && memberEmails.length > 0) {
      for (const email of memberEmails) {
        if (!email || typeof email !== 'string') continue;
        const normalizedEmail = email.toLowerCase().trim();
        if (normalizedEmail === req.user.email.toLowerCase()) continue;

        const user = await User.findOne({ email: normalizedEmail });
        if (user && !addedUserIds.has(user._id.toString())) {
          addedUserIds.add(user._id.toString());
          membersList.push({
            user: user._id,
            role: 'member',
            joinedAt: new Date(),
          });
          invitedUsers.push(user);
        }
      }
    }

    const group = await Group.create({
      name: name.trim(),
      description: description ? description.trim() : '',
      category: groupCategory,
      createdBy: req.user._id,
      members: membersList,
    });

    // Populate members for response
    await group.populate('members.user', 'name email profilePicture');
    await group.populate('createdBy', 'name email');

    // Log Activity
    await logActivity({
      groupId: group._id,
      userId: req.user._id,
      action: 'group_created',
      description: `${req.user.name} created the group "${group.name}".`,
    });

    // Send notifications to added members
    for (const invUser of invitedUsers) {
      await createNotification({
        userId: invUser._id,
        groupId: group._id,
        type: 'group_invite',
        message: `${req.user.name} added you to the group "${group.name}".`,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Group created successfully.',
      group,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all groups for current user
// @route   GET /api/groups
// @access  Private
const getGroups = async (req, res, next) => {
  try {
    const groups = await Group.find({ 'members.user': req.user._id })
      .populate('members.user', 'name email profilePicture')
      .populate('createdBy', 'name email')
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      count: groups.length,
      groups,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single group details
// @route   GET /api/groups/:groupId
// @access  Private (Group member only)
const getGroupById = async (req, res, next) => {
  try {
    // req.group is already populated and verified by isGroupMember middleware
    const group = await Group.findById(req.group._id)
      .populate('members.user', 'name email profilePicture')
      .populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      group,
      userRole: req.groupMember.role,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update group details
// @route   PUT /api/groups/:groupId
// @access  Private (Admin only)
const updateGroup = async (req, res, next) => {
  try {
    const { name, description, category } = req.body;
    const group = req.group;

    if (name) group.name = name.trim();
    if (description !== undefined) group.description = description.trim();
    if (category) {
      const validCategories = ['Trip', 'Hostel', 'Flat / Roommates', 'Family', 'Party', 'Other'];
      if (validCategories.includes(category)) {
        group.category = category;
      }
    }

    await group.save();
    await group.populate('members.user', 'name email profilePicture');

    await logActivity({
      groupId: group._id,
      userId: req.user._id,
      action: 'group_updated',
      description: `${req.user.name} updated group details.`,
    });

    res.status(200).json({
      success: true,
      message: 'Group updated successfully.',
      group,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete group
// @route   DELETE /api/groups/:groupId
// @access  Private (Admin only)
const deleteGroup = async (req, res, next) => {
  try {
    const groupId = req.group._id;

    // Delete associated expenses, settlements, and activities
    await Promise.all([
      Expense.deleteMany({ groupId }),
      Settlement.deleteMany({ groupId }),
      Activity.deleteMany({ groupId }),
      Group.findByIdAndDelete(groupId),
    ]);

    res.status(200).json({
      success: true,
      message: 'Group and all associated records deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add member to group by email
// @route   POST /api/groups/:groupId/members
// @access  Private (Group member/admin)
const addMember = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide user email to add.',
      });
    }

    const userToAdd = await User.findOne({ email: email.toLowerCase().trim() });
    if (!userToAdd) {
      return res.status(404).json({
        success: false,
        message: 'No registered user found with that email address. Please make sure they have signed up first.',
      });
    }

    const group = req.group;
    const isAlreadyMember = group.members.some(
      (m) => (m.user._id || m.user).toString() === userToAdd._id.toString()
    );

    if (isAlreadyMember) {
      return res.status(400).json({
        success: false,
        message: `${userToAdd.name} (${userToAdd.email}) is already a member of this group.`,
      });
    }

    group.members.push({
      user: userToAdd._id,
      role: 'member',
      joinedAt: new Date(),
    });

    await group.save();
    await group.populate('members.user', 'name email profilePicture');

    // Activity & Notification
    await logActivity({
      groupId: group._id,
      userId: req.user._id,
      action: 'member_added',
      description: `${req.user.name} added ${userToAdd.name} to the group.`,
    });

    await createNotification({
      userId: userToAdd._id,
      groupId: group._id,
      type: 'group_invite',
      message: `${req.user.name} added you to group "${group.name}".`,
    });

    res.status(200).json({
      success: true,
      message: `${userToAdd.name} has been added to the group.`,
      group,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove member from group
// @route   DELETE /api/groups/:groupId/members/:userId
// @access  Private (Admin or removing oneself)
const removeMember = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const group = req.group;

    const memberToRemove = group.members.find(
      (m) => (m.user._id || m.user).toString() === userId
    );

    if (!memberToRemove) {
      return res.status(404).json({
        success: false,
        message: 'Member not found in this group.',
      });
    }

    // Permission check: either group admin, or user removing themselves
    const isSelf = req.user._id.toString() === userId;
    const isAdmin = req.groupMember.role === 'admin';

    if (!isSelf && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only group admins can remove other members.',
      });
    }

    // Check financial balance restriction: cannot remove a member with unsettled balance!
    const balanceData = await calculateGroupBalances(group._id);
    const memberBalance = balanceData.balances.find(
      (b) => b.user._id.toString() === userId
    );

    if (memberBalance && Math.abs(memberBalance.netBalance) > 0.05) {
      return res.status(400).json({
        success: false,
        message: `Cannot remove member with outstanding balance of ₹${Math.abs(
          memberBalance.netBalance
        )}. Member must be settled first.`,
      });
    }

    // Filter out the member
    group.members = group.members.filter(
      (m) => (m.user._id || m.user).toString() !== userId
    );

    // If no admins left and group still has members, promote the first member
    const hasAdmin = group.members.some((m) => m.role === 'admin');
    if (!hasAdmin && group.members.length > 0) {
      group.members[0].role = 'admin';
    }

    await group.save();
    await group.populate('members.user', 'name email profilePicture');

    const removedUser = await User.findById(userId);
    const removedName = removedUser ? removedUser.name : 'A member';

    await logActivity({
      groupId: group._id,
      userId: req.user._id,
      action: 'member_removed',
      description: `${req.user.name} removed ${removedName} from the group.`,
    });

    if (!isSelf) {
      await createNotification({
        userId,
        groupId: group._id,
        type: 'member_removed',
        message: `You were removed from "${group.name}".`,
      });
    }

    res.status(200).json({
      success: true,
      message: `${removedName} was removed from the group.`,
      group,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createGroup,
  getGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  addMember,
  removeMember,
};
