const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const Group = require('../models/Group');

// Helper to convert Rupees to integer Paise (safe integer currency math)
const toPaise = (rupees) => Math.round(Number(rupees || 0) * 100);

// Helper to convert Paise back to Rupees formatted to 2 decimals
const fromPaise = (paise) => Number((Number(paise || 0) / 100).toFixed(2));

/**
 * Calculates complete balances and metrics for all members of a group.
 * @param {string} groupId - MongoDB ObjectId of the group
 * @returns {Promise<Object>} Object containing totals, member balances, and suggested settlements
 */
const calculateGroupBalances = async (groupId) => {
  const group = await Group.findById(groupId).populate(
    'members.user',
    'name email profilePicture'
  );

  if (!group) {
    throw new Error('Group not found');
  }

  // Fetch all expenses and completed settlements for this group
  const [expenses, settlements] = await Promise.all([
    Expense.find({ groupId }).populate('paidBy', 'name email').populate('participants.user', 'name email'),
    Settlement.find({ groupId, status: 'completed' })
      .populate('paidBy', 'name email')
      .populate('paidTo', 'name email'),
  ]);

  // Initialize tracking map for all group members in paise
  const memberMap = new Map();

  group.members.forEach((m) => {
    if (m.user) {
      const uId = (m.user._id || m.user).toString();
      memberMap.set(uId, {
        user: {
          _id: uId,
          name: m.user.name || 'Member',
          email: m.user.email || '',
          profilePicture: m.user.profilePicture || '',
        },
        role: m.role || 'member',
        totalPaidPaise: 0,
        totalSharePaise: 0,
        settlementsPaidPaise: 0,
        settlementsReceivedPaise: 0,
      });
    }
  });

  let totalGroupExpensePaise = 0;

  // Process all expenses
  expenses.forEach((expense) => {
    const expensePaise = toPaise(expense.amount);
    totalGroupExpensePaise += expensePaise;

    const payerId = (expense.paidBy._id || expense.paidBy).toString();
    if (memberMap.has(payerId)) {
      memberMap.get(payerId).totalPaidPaise += expensePaise;
    }

    // Process participant shares
    expense.participants.forEach((participant) => {
      const participantId = (participant.user._id || participant.user).toString();
      const sharePaise = toPaise(participant.shareAmount);
      if (memberMap.has(participantId)) {
        memberMap.get(participantId).totalSharePaise += sharePaise;
      }
    });
  });

  // Process all settlements
  settlements.forEach((settlement) => {
    const settlementPaise = toPaise(settlement.amount);
    const payerId = (settlement.paidBy._id || settlement.paidBy).toString();
    const recipientId = (settlement.paidTo._id || settlement.paidTo).toString();

    if (memberMap.has(payerId)) {
      memberMap.get(payerId).settlementsPaidPaise += settlementPaise;
    }
    if (memberMap.has(recipientId)) {
      memberMap.get(recipientId).settlementsReceivedPaise += settlementPaise;
    }
  });

  // Build balances array
  const memberCount = memberMap.size;
  const equalSharePaise = memberCount > 0 ? Math.round(totalGroupExpensePaise / memberCount) : 0;

  const balances = [];
  const debtors = []; // Net negative: owes money
  const creditors = []; // Net positive: receives money

  memberMap.forEach((data, userId) => {
    // Net Balance Formula:
    // (Total Paid for Expenses - Total Share of Expenses) + (Settlements Paid - Settlements Received)
    const netBalancePaise =
      (data.totalPaidPaise - data.totalSharePaise) +
      (data.settlementsPaidPaise - data.settlementsReceivedPaise);

    const netBalance = fromPaise(netBalancePaise);
    let status = 'settled';
    if (netBalancePaise > 0) status = 'receives';
    else if (netBalancePaise < 0) status = 'owes';

    const memberBalance = {
      user: data.user,
      role: data.role,
      totalPaid: fromPaise(data.totalPaidPaise),
      totalShare: fromPaise(data.totalSharePaise),
      settlementsPaid: fromPaise(data.settlementsPaidPaise),
      settlementsReceived: fromPaise(data.settlementsReceivedPaise),
      netBalance,
      status,
    };

    balances.push(memberBalance);

    if (netBalancePaise < -5) {
      // Allow minor 5-paise rounding tolerance
      debtors.push({
        user: data.user,
        amountPaise: Math.abs(netBalancePaise),
      });
    } else if (netBalancePaise > 5) {
      creditors.push({
        user: data.user,
        amountPaise: netBalancePaise,
      });
    }
  });

  // Generate optimized settlement suggestions
  // Greedy algorithm: match largest debtor with largest creditor
  const settlementSuggestions = [];

  // Work on copies of debtors and creditors
  const remainingDebtors = debtors.map((d) => ({ ...d }));
  const remainingCreditors = creditors.map((c) => ({ ...c }));

  // Sort creditors descending, debtors descending by debt
  remainingCreditors.sort((a, b) => b.amountPaise - a.amountPaise);
  remainingDebtors.sort((a, b) => b.amountPaise - a.amountPaise);

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < remainingDebtors.length && cIdx < remainingCreditors.length) {
    const debtor = remainingDebtors[dIdx];
    const creditor = remainingCreditors[cIdx];

    const settlePaise = Math.min(debtor.amountPaise, creditor.amountPaise);

    if (settlePaise > 0) {
      settlementSuggestions.push({
        fromUser: debtor.user,
        toUser: creditor.user,
        amount: fromPaise(settlePaise),
      });

      debtor.amountPaise -= settlePaise;
      creditor.amountPaise -= settlePaise;
    }

    if (debtor.amountPaise <= 5) {
      dIdx++;
    }
    if (creditor.amountPaise <= 5) {
      cIdx++;
    }
  }

  return {
    groupId: group._id,
    groupName: group.name,
    totalExpenses: fromPaise(totalGroupExpensePaise),
    equalShare: fromPaise(equalSharePaise),
    memberCount,
    expenseCount: expenses.length,
    settlementCount: settlements.length,
    balances,
    settlementSuggestions,
  };
};

module.exports = {
  calculateGroupBalances,
  toPaise,
  fromPaise,
};
