/**
 * ═══════════════════════════════════════════════════════════════
 *  Analytics Routes
 * ═══════════════════════════════════════════════════════════════
 * All routes require authentication.
 * ═══════════════════════════════════════════════════════════════
 */
const express = require('express');
const AnalyticsController = require('../controllers/analytics.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/analytics/dashboard
 * Full dashboard data (stats + recent txns + accounts).
 */
router.get('/dashboard', AnalyticsController.getDashboard);

/**
 * GET /api/v1/analytics/spending?months=6
 * Monthly spending with MoM % change.
 */
router.get('/spending', AnalyticsController.getSpending);

/**
 * GET /api/v1/analytics/trends?days=30
 * Daily transaction volume + running totals.
 */
router.get('/trends', AnalyticsController.getTrends);

/**
 * GET /api/v1/analytics/recipients?limit=5
 * Top recipients by frequency.
 */
router.get('/recipients', AnalyticsController.getRecipients);

/**
 * GET /api/v1/analytics/fraud-stats
 * Fraud flag breakdown by severity and type.
 */
router.get('/fraud-stats', AnalyticsController.getFraudStats);

module.exports = router;
