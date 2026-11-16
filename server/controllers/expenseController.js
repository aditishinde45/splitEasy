const Expense = require('../models/Expense');
const Group = require('../models/Group');
const User = require('../models/User');
const { toPaise, fromPaise } = require('../services/calculationService');
const { notifyGroupMembers } = require('../services/notificationService');
const { logActivity } = require('../services/activityService');

/**
 * Validates and calculates participant shares based on splitType
 */
const computeParticipantShares = (totalAmount, splitType, rawParticipants, groupMemberIds) => {
  const totalPaise = toPaise(totalAmount);

  if (totalPaise <= 0) {
    throw new Error('Expense amount must be greater than zero.');
  }

  if (!Array.isArray(rawParticipants) || rawParticipants.length === 0) {
    throw new Error('At least one participant must be included in the expense.');
  }

  // Validate all participants belong to the group
  const participantUserIds = rawParticipants.map((p) =>
    (p.user && (p.user._id || p.user)) ? (p.user._id || p.user).toString() : p.toString()
  );

  for (const pId of participantUserIds) {
    if (!groupMemberIds.includes(pId)) {
      throw new Error(`Participant with ID ${pId} is not a member of this group.`);
    }
  }

  const count = participantUserIds.length;
  const processed = [];

  if (splitType === 'equal') {
    const baseSharePaise = Math.floor(totalPaise / count);
    let remainder = totalPaise % count;

    for (let i = 0; i < count; i++) {
      const share = baseSharePaise + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
      processed.push({
        user: participantUserIds[i],
        shareAmount: fromPaise(share),
        sharePercentage: Number(((share / totalPaise) * 100).toFixed(2)),
      });
    }
  } else if (splitType === 'custom') {
    let sumPaise = 0;
    for (const p of rawParticipants) {
      const uId = (p.user && (p.user._id || p.user)) ? (p.user._id || p.user).toString() : p.toString();
      const sharePaise = toPaise(p.shareAmount);
      if (sharePaise < 0) {
        throw new Error('Individual share amounts cannot be negative.');
      }
      sumPaise += sharePaise;
      processed.push({
        user: uId,
        shareAmount: fromPaise(sharePaise),
        sharePercentage: Number(((sharePaise / totalPaise) * 100).toFixed(2)),
      });
    }

    if (Math.abs(sumPaise - totalPaise) > 2) {
      // 2 paise rounding allowance
      throw new Error(
        `The sum of individual shares (₹${fromPaise(sumPaise)}) must equal the total amount (₹${fromPaise(totalPaise)}).`
      );
    }
  } else if (splitType === 'percentage') {
    let sumPercentage = 0;
    let distributedPaise = 0;

    for (const p of rawParticipants) {
      const uId = (p.user && (p.user._id || p.user)) ? (p.user._id || p.user).toString() : p.toString();
      const pct = Number(p.sharePercentage);
      if (isNaN(pct) || pct < 0) {
        throw new Error('Percentages must be non-negative numbers.');
      }
      sumPercentage += pct;

      const sharePaise = Math.round((pct / 100) * totalPaise);
      distributedPaise += sharePaise;

      processed.push({
        user: uId,
        shareAmount: fromPaise(sharePaise),
        sharePercentage: pct,
      });
    }

    if (Math.abs(sumPercentage - 100) > 0.1) {
      throw new Error(`The sum of percentages must equal 100% (currently ${sumPercentage.toFixed(1)}%).`);
    }

    // Adjust any small 1-2 paise rounding discrepancy into the first participant
    const diff = totalPaise - distributedPaise;
    if (diff !== 0 && processed.length > 0) {
      const adjustedPaise = toPaise(processed[0].shareAmount) + diff;
      processed[0].shareAmount = fromPaise(adjustedPaise);
    }
  } else {
    throw new Error(`Unsupported split type: ${splitType}`);
  }

  return processed;
};

// @desc    Create a new expense in a group
// @route   POST /api/expenses
// @access  Private (Group member only)
const createExpense = async (req, res, next) => {
  try {
    const { groupId, description, amount, paidBy, splitType = 'equal', category = 'Other', date, participants } = req.body;

    if (!groupId || !description || !amount || !paidBy) {
      return res.status(400).json({
        success: false,
        message: 'Please provide groupId, description, amount, and paidBy.',
      });
    }

    // Verify group
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
    const paidByIdStr = (paidBy._id || paidBy).toString();

    if (!groupMemberIds.includes(paidByIdStr)) {
      return res.status(400).json({
        success: false,
        message: 'The payer specified is not a member of this group.',
      });
    }

    // Calculate participant shares
    const finalParticipants = computeParticipantShares(
      amount,
      splitType,
      participants && participants.length > 0 ? participants : groupMemberIds.map((id) => ({ user: id })),
      groupMemberIds
    );

    const expense = await Expense.create({
      groupId,
      description: description.trim(),
      amount: fromPaise(toPaise(amount)),
      paidBy: paidByIdStr,
      participants: finalParticipants,
      splitType,
      category,
      date: date ? new Date(date) : new Date(),
      createdBy: req.user._id,
    });

    await expense.populate('paidBy', 'name email profilePicture');
    await expense.populate('participants.user', 'name email profilePicture');

    // Log Activity
    const payerUser = await User.findById(paidByIdStr);
    const payerName = payerUser ? payerUser.name : 'A member';
    await logActivity({
      groupId,
      userId: req.user._id,
      action: 'expense_created',
      description: `${req.user.name} added expense "${expense.description}" (₹${expense.amount}) paid by ${payerName}.`,
    });

    // Notify other group members
    await notifyGroupMembers({
      groupId,
      excludeUserId: req.user._id,
      type: 'new_expense',
      message: `New expense "${expense.description}" (₹${expense.amount}) added in "${group.name}".`,
    });

    res.status(201).json({
      success: true,
      message: 'Expense added successfully.',
      expense,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all expenses for a group (with search, filter, sort)
// @route   GET /api/expenses/group/:groupId
// @access  Private (Group member only)
const getExpensesByGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { search, category, payer, sort = 'date_desc', page = 1, limit = 50 } = req.query;

    const query = { groupId };

    // Search by description
    if (search && search.trim()) {
      query.description = { $regex: search.trim(), $options: 'i' };
    }

    // Filter by category
    if (category && category !== 'All') {
      query.category = category;
    }

    // Filter by payer
    if (payer && payer !== 'All') {
      query.paidBy = payer;
    }

    // Sorting
    let sortObj = { date: -1, createdAt: -1 };
    if (sort === 'date_asc') sortObj = { date: 1, createdAt: 1 };
    else if (sort === 'amount_desc') sortObj = { amount: -1 };
    else if (sort === 'amount_asc') sortObj = { amount: 1 };

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [expenses, total] = await Promise.all([
      Expense.find(query)
        .populate('paidBy', 'name email profilePicture')
        .populate('participants.user', 'name email profilePicture')
        .populate('createdBy', 'name email')
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum),
      Expense.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: expenses.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      expenses,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single expense by ID
// @route   GET /api/expenses/:expenseId
// @access  Private (Group member only)
const getExpenseById = async (req, res, next) => {
  try {
    const { expenseId } = req.params;
    const expense = await Expense.findById(expenseId)
      .populate('paidBy', 'name email profilePicture')
      .populate('participants.user', 'name email profilePicture')
      .populate('groupId', 'name category');

    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found.' });
    }

    // Verify user is in group
    const group = await Group.findById(expense.groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group for this expense not found.' });
    }

    const isMember = group.members.some(
      (m) => (m.user._id || m.user).toString() === req.user._id.toString()
    );
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.status(200).json({
      success: true,
      expense,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update expense
// @route   PUT /api/expenses/:expenseId
// @access  Private (Group member only)
const updateExpense = async (req, res, next) => {
  try {
    const { expenseId } = req.params;
    const { description, amount, paidBy, splitType, category, date, participants } = req.body;

    const expense = await Expense.findById(expenseId);
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found.' });
    }

    const group = await Group.findById(expense.groupId);
    const isMember = group.members.some(
      (m) => (m.user._id || m.user).toString() === req.user._id.toString()
    );
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const groupMemberIds = group.members.map((m) => (m.user._id || m.user).toString());
    const finalAmount = amount !== undefined ? amount : expense.amount;
    const finalSplitType = splitType || expense.splitType;
    const finalPaidBy = paidBy ? (paidBy._id || paidBy).toString() : expense.paidBy.toString();

    if (!groupMemberIds.includes(finalPaidBy)) {
      return res.status(400).json({
        success: false,
        message: 'The payer specified is not a member of this group.',
      });
    }

    const finalParticipants = computeParticipantShares(
      finalAmount,
      finalSplitType,
      participants && participants.length > 0 ? participants : expense.participants,
      groupMemberIds
    );

    if (description) expense.description = description.trim();
    expense.amount = fromPaise(toPaise(finalAmount));
    expense.paidBy = finalPaidBy;
    expense.splitType = finalSplitType;
    if (category) expense.category = category;
    if (date) expense.date = new Date(date);
    expense.participants = finalParticipants;

    await expense.save();
    await expense.populate('paidBy', 'name email profilePicture');
    await expense.populate('participants.user', 'name email profilePicture');

    await logActivity({
      groupId: expense.groupId,
      userId: req.user._id,
      action: 'expense_updated',
      description: `${req.user.name} updated expense "${expense.description}" (₹${expense.amount}).`,
    });

    await notifyGroupMembers({
      groupId: expense.groupId,
      excludeUserId: req.user._id,
      type: 'expense_updated',
      message: `Expense "${expense.description}" was updated in "${group.name}".`,
    });

    res.status(200).json({
      success: true,
      message: 'Expense updated successfully.',
      expense,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete expense
// @route   DELETE /api/expenses/:expenseId
// @access  Private (Group member only)
const deleteExpense = async (req, res, next) => {
  try {
    const { expenseId } = req.params;
    const expense = await Expense.findById(expenseId);

    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found.' });
    }

    const group = await Group.findById(expense.groupId);
    const isMember = group.members.some(
      (m) => (m.user._id || m.user).toString() === req.user._id.toString()
    );
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const desc = expense.description;
    const amt = expense.amount;
    const groupId = expense.groupId;

    await Expense.findByIdAndDelete(expenseId);

    await logActivity({
      groupId,
      userId: req.user._id,
      action: 'expense_deleted',
      description: `${req.user.name} deleted expense "${desc}" (₹${amt}).`,
    });

    await notifyGroupMembers({
      groupId,
      excludeUserId: req.user._id,
      type: 'expense_deleted',
      message: `Expense "${desc}" was deleted from "${group.name}".`,
    });

    res.status(200).json({
      success: true,
      message: 'Expense deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createExpense,
  getExpensesByGroup,
  getExpenseById,
  updateExpense,
  deleteExpense,
};
