const express = require('express');
const router = express.Router();
const {
  getGroupBalances,
  getSettlementSuggestions,
} = require('../controllers/balanceController');
const { protect } = require('../middleware/auth');
const { isGroupMember } = require('../middleware/groupAuth');

router.use(protect);

router.get('/:groupId/balances', isGroupMember, getGroupBalances);
router.get('/:groupId/settlement-suggestions', isGroupMember, getSettlementSuggestions);

module.exports = router;
