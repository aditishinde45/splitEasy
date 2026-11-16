const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile,
  searchUsers,
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.get('/search', searchUsers);

module.exports = router;
