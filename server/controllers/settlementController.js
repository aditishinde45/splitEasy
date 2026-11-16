const Settlement = require('../models/Settlement');
const Group = require('../models/Group');
const User = require('../models/User');
const { calculateGroupBalances, toPaise, fromPaise } = require('../services/calculationService');
const { createNotification } = require('../services/notificationService');
const { logActivity } = require('../services/activityService');

// @desc    Record a settlement payment between two group members
// @route   POST /api/settlements
// @access  Private (Group member only)
const createSettlement = async (req, res, next) => {
  try {
    const { groupId, paidBy, paidTo, amount, paymentDate, notes } = req.body;

    if (!groupId || !paidBy || !paidTo || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Please provide groupId, paidBy, paidTo, and amount.',
      });
    }

    const parsedAmount = fromPaise(toPaise(amount));
    if (parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Settlement amount must be greater than zero.',
      });
    }

    const payerId = (paidBy._id || paidBy).toString();
    const recipientId = (paidTo._id || paidTo).toString();

    if (payerId === recipientId) {
      return res.status(400).json({
        success: false,
        message: 'Sender and recipient cannot be the same member.',
      });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    // Verify current user is member of group
    const isMember = group.members.some(
      (m) => (m.user._id || m.user).toString() === req.user._id.toString()
    );
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'You are not a member of this group.' });
    }

    const groupMemberIds = group.members.map((m) => (m.user._id || m.user).toString());
    if (!groupMemberIds.includes(payerId) || !groupMemberIds.includes(recipientId)) {
      return res.status(400).json({
        success: false,
        message: 'Both sender and recipient must be active members of this group.',
      });
    }

    // Duplicate submission check: prevent accidental double-clicks within last 5 seconds
    const recentDuplicate = await Settlement.findOne({
      groupId,
      paidBy: payerId,
      paidTo: recipientId,
      amount: parsedAmount,
      createdAt: { $gte: new Date(Date.now() - 5000) },
    });

    if (recentDuplicate) {
      return res.status(400).json({
        success: false,
        message: 'A duplicate settlement was just recorded moments ago. Please avoid resubmitting.',
      });
    }

    const settlement = await Settlement.create({
      groupId,
      paidBy: payerId,
      paidTo: recipientId,
      amount: parsedAmount,
      status: 'completed',
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      notes: notes ? notes.trim() : '',
    });

    await settlement.populate('paidBy', 'name email profilePicture');
    await settlement.populate('paidTo', 'name email profilePicture');

    // Log Activity
    const payerUser = await User.findById(payerId);
    const recipientUser = await User.findById(recipientId);
    const payerName = payerUser ? payerUser.name : 'A member';
    const recipientName = recipientUser ? recipientUser.name : 'A member';

    await logActivity({
      groupId,
      userId: req.user._id,
      action: 'settlement_recorded',
      description: `${payerName} paid ₹${parsedAmount} to ${recipientName}.`,
    });

    // Notify recipient
    await createNotification({
      userId: recipientId,
      groupId,
      type: 'settlement_created',
      message: `${payerName} recorded a payment of ₹${parsedAmount} to you in "${group.name}".`,
    });

    // Calculate updated balances
    const updatedBalances = await calculateGroupBalances(groupId);

    res.status(201).json({
      success: true,
      message: `Settlement of ₹${parsedAmount} recorded successfully.`,
      settlement,
      updatedBalances,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all settlements for a group
// @route   GET /api/settlements/group/:groupId
// @access  Private (Group member only)
const getSettlementsByGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    const isMember = group.members.some(
      (m) => (m.user._id || m.user).toString() === req.user._id.toString()
    );
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const settlements = await Settlement.find({ groupId })
      .populate('paidBy', 'name email profilePicture')
      .populate('paidTo', 'name email profilePicture')
      .sort({ paymentDate: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: settlements.length,
      settlements,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single settlement
// @route   GET /api/settlements/:settlementId
// @access  Private (Group member only)
const getSettlementById = async (req, res, next) => {
  try {
    const { settlementId } = req.params;
    const settlement = await Settlement.findById(settlementId)
      .populate('paidBy', 'name email profilePicture')
      .populate('paidTo', 'name email profilePicture')
      .populate('groupId', 'name category');

    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Settlement not found.' });
    }

    const group = await Group.findById(settlement.groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    const isMember = group.members.some(
      (m) => (m.user._id || m.user).toString() === req.user._id.toString()
    );
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.status(200).json({
      success: true,
      settlement,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSettlement,
  getSettlementsByGroup,
  getSettlementById,
};
