const express = require('express');
const router = express.Router();
const {
  createExpense,
  getExpensesByGroup,
  getExpenseById,
  updateExpense,
  deleteExpense,
} = require('../controllers/expenseController');
const { protect } = require('../middleware/auth');
const { isGroupMember } = require('../middleware/groupAuth');

router.use(protect);

router.post('/', createExpense);
router.get('/group/:groupId', isGroupMember, getExpensesByGroup);
router.route('/:expenseId')
  .get(getExpenseById)
  .put(updateExpense)
  .delete(deleteExpense);

module.exports = router;
