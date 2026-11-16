const express = require('express');
const router = express.Router();
const {
  getDashboardSummary,
  getRecentActivity,
} = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/summary', getDashboardSummary);
router.get('/recent-activity', getRecentActivity);

module.exports = router;
