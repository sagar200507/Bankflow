/**
 * ═══════════════════════════════════════════════════════════════
 *  Analytics Controller — HTTP Request Handlers
 * ═══════════════════════════════════════════════════════════════
 */
const AnalyticsService = require('../services/analytics.service');
const { successResponse } = require('../utils/response');
const catchAsync = require('../utils/catchAsync');

const AnalyticsController = {
  /**
   * GET /api/v1/analytics/dashboard
   * Returns dashboard KPI stats, recent transactions, and accounts.
   */
  getDashboard: catchAsync(async (req, res) => {
    const data = await AnalyticsService.getDashboardData(req.user.id);
    return successResponse(res, 200, 'Dashboard data retrieved', data);
  }),

  /**
   * GET /api/v1/analytics/spending?months=6
   * Returns monthly spending breakdown for charts.
   */
  getSpending: catchAsync(async (req, res) => {
    const months = parseInt(req.query.months, 10) || 6;
    const data = await AnalyticsService.getMonthlySpending(req.user.id, months);
    return successResponse(res, 200, 'Monthly spending retrieved', { spending: data });
  }),

  /**
   * GET /api/v1/analytics/trends?days=30
   * Returns daily transaction trends for charts.
   */
  getTrends: catchAsync(async (req, res) => {
    const days = parseInt(req.query.days, 10) || 30;
    const data = await AnalyticsService.getTransactionTrends(req.user.id, days);
    return successResponse(res, 200, 'Transaction trends retrieved', { trends: data });
  }),

  /**
   * GET /api/v1/analytics/recipients?limit=5
   * Returns top transaction recipients.
   */
  getRecipients: catchAsync(async (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 5;
    const data = await AnalyticsService.getTopRecipients(req.user.id, limit);
    return successResponse(res, 200, 'Top recipients retrieved', { recipients: data });
  }),

  /**
   * GET /api/v1/analytics/fraud-stats
   * Returns fraud statistics for the dashboard widget.
   */
  getFraudStats: catchAsync(async (req, res) => {
    const data = await AnalyticsService.getFraudStats(req.user.id);
    return successResponse(res, 200, 'Fraud statistics retrieved', { fraudStats: data });
  }),
};

module.exports = AnalyticsController;
