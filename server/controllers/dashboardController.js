const Group = require('../models/Group');
const Expense = require('../models/Expense');
const Activity = require('../models/Activity');
const { calculateGroupBalances, fromPaise, toPaise } = require('../services/calculationService');

// @desc    Get aggregated dashboard summary for current user
// @route   GET /api/dashboard/summary
// @access  Private
const getDashboardSummary = async (req, res, next) => {
  try {
    const userId = req.user._id.toString();

    // 1. Fetch all groups user is member of
    const userGroups = await Group.find({ 'members.user': req.user._id })
      .populate('members.user', 'name email profilePicture')
      .sort({ updatedAt: -1 });

    const totalGroups = userGroups.length;
    const groupIds = userGroups.map((g) => g._id);

    let totalExpensesPaise = 0;
    let totalPaidByUserPaise = 0;
    let totalUserOwesPaise = 0;
    let totalOwedToUserPaise = 0;

    const groupBalancesSummary = [];

    // Calculate balances for each group
    for (const group of userGroups) {
      try {
        const balanceData = await calculateGroupBalances(group._id);
        totalExpensesPaise += toPaise(balanceData.totalExpenses);

        const memberBalance = balanceData.balances.find(
          (b) => b.user._id.toString() === userId
        );

        if (memberBalance) {
          totalPaidByUserPaise += toPaise(memberBalance.totalPaid);

          if (memberBalance.netBalance < -0.01) {
            totalUserOwesPaise += Math.abs(toPaise(memberBalance.netBalance));
          } else if (memberBalance.netBalance > 0.01) {
            totalOwedToUserPaise += toPaise(memberBalance.netBalance);
          }

          groupBalancesSummary.push({
            groupId: group._id,
            groupName: group.name,
            category: group.category,
            memberCount: group.members.length,
            totalGroupExpenses: balanceData.totalExpenses,
            userNetBalance: memberBalance.netBalance,
            userStatus: memberBalance.status,
          });
        }
      } catch (err) {
        console.error(`Error calculating group ${group._id} balances:`, err);
      }
    }

    // 2. Recent expenses across all user's groups
    const recentExpenses = await Expense.find({ groupId: { $in: groupIds } })
      .populate('paidBy', 'name email profilePicture')
      .populate('groupId', 'name category')
      .sort({ date: -1, createdAt: -1 })
      .limit(6);

    // 3. Recent activity across all user's groups
    const recentActivity = await Activity.find({ groupId: { $in: groupIds } })
      .populate('userId', 'name profilePicture')
      .populate('groupId', 'name category')
      .sort({ createdAt: -1 })
      .limit(8);

    res.status(200).json({
      success: true,
      summary: {
        totalGroups,
        totalExpenses: fromPaise(totalExpensesPaise),
        totalPaidByUser: fromPaise(totalPaidByUserPaise),
        totalUserOwes: fromPaise(totalUserOwesPaise),
        totalOwedToUser: fromPaise(totalOwedToUserPaise),
        netTotal: fromPaise(totalOwedToUserPaise - totalUserOwesPaise),
      },
      groupBalancesSummary,
      recentExpenses,
      recentActivity,
      groups: userGroups,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get recent activity feed
// @route   GET /api/dashboard/recent-activity
// @access  Private
const getRecentActivity = async (req, res, next) => {
  try {
    const userGroups = await Group.find({ 'members.user': req.user._id }).select('_id');
    const groupIds = userGroups.map((g) => g._id);

    const activities = await Activity.find({ groupId: { $in: groupIds } })
      .populate('userId', 'name profilePicture')
      .populate('groupId', 'name category')
      .sort({ createdAt: -1 })
      .limit(30);

    res.status(200).json({
      success: true,
      count: activities.length,
      activities,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardSummary,
  getRecentActivity,
};
