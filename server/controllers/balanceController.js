const { calculateGroupBalances } = require('../services/calculationService');

// @desc    Get group balances and calculations
// @route   GET /api/groups/:groupId/balances
// @access  Private (Group member only)
const getGroupBalances = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const balanceData = await calculateGroupBalances(groupId);

    res.status(200).json({
      success: true,
      data: balanceData,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get settlement suggestions for group
// @route   GET /api/groups/:groupId/settlement-suggestions
// @access  Private (Group member only)
const getSettlementSuggestions = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const balanceData = await calculateGroupBalances(groupId);

    res.status(200).json({
      success: true,
      suggestions: balanceData.settlementSuggestions,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getGroupBalances,
  getSettlementSuggestions,
};
