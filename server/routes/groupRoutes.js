const express = require('express');
const router = express.Router();
const {
  createGroup,
  getGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  addMember,
  removeMember,
} = require('../controllers/groupController');
const { protect } = require('../middleware/auth');
const { isGroupMember, isGroupAdmin } = require('../middleware/groupAuth');

router.use(protect);

router.route('/')
  .post(createGroup)
  .get(getGroups);

router.route('/:groupId')
  .get(isGroupMember, getGroupById)
  .put(isGroupMember, isGroupAdmin, updateGroup)
  .delete(isGroupMember, isGroupAdmin, deleteGroup);

router.post('/:groupId/members', isGroupMember, addMember);
router.delete('/:groupId/members/:userId', isGroupMember, removeMember);

module.exports = router;
