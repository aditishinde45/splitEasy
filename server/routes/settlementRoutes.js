const express = require('express');
const router = express.Router();
const {
  createSettlement,
  getSettlementsByGroup,
  getSettlementById,
} = require('../controllers/settlementController');
const { protect } = require('../middleware/auth');
const { isGroupMember } = require('../middleware/groupAuth');

router.use(protect);

router.post('/', createSettlement);
router.get('/group/:groupId', isGroupMember, getSettlementsByGroup);
router.get('/:settlementId', getSettlementById);

module.exports = router;
