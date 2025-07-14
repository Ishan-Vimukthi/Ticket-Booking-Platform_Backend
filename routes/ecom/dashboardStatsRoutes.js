const express = require('express');
const router = express.Router();
const { getDashboardStats, getBusinessInsights } = require('../../controllers/ecom/dashboardStatsController');

/**
 * @route GET /api/ecom/dashboard/stats
 * @desc Get comprehensive dashboard statistics in a single call
 * @access Public (for now, matching your current setup)
 * @returns {Object} Complete dashboard data including products, customers, orders, revenue
 */
router.get('/stats', getDashboardStats);

/**
 * @route GET /api/ecom/dashboard/insights
 * @desc Get business insights with growth metrics
 * @access Public
 * @returns {Object} Monthly comparisons and growth percentages
 */
router.get('/insights', getBusinessInsights);

module.exports = router;
