/**
 * ═══════════════════════════════════════════════════════════════
 *  Analytics Service — Business Logic Layer (with Redis Caching)
 * ═══════════════════════════════════════════════════════════════
 *
 * Orchestrates analytics data retrieval with cache-aside pattern.
 * Dashboard stats are the most expensive queries (fn_dashboard_stats
 * runs 6 subqueries), so caching provides the biggest win here.
 *
 * Cache hit ratio expectation:
 *   Dashboard:  ~95% (users refresh frequently, data changes rarely)
 *   Spending:   ~90% (viewed once per session)
 *   Trends:     ~90% (viewed once per session)
 *   Recipients: ~95% (rarely changes)
 * ═══════════════════════════════════════════════════════════════
 */
const AnalyticsModel = require('../models/analytics.model');
const TransactionModel = require('../models/transaction.model');
const AccountModel = require('../models/account.model');
const CacheService = require('./cache.service');
const { CACHE_KEYS } = require('../utils/constants');

const AnalyticsService = {
  /**
   * Get dashboard KPI stats + recent transactions.
   *
   * Cache strategy:
   *   • Stats are cached with 2-min TTL (expensive, slow-changing)
   *   • Recent transactions are NOT cached (must be real-time)
   *   • Accounts are cached with 1-min TTL
   *
   * @param {string} userId - User UUID
   * @returns {object} { stats, recentTransactions, accounts }
   */
  async getDashboardData(userId) {
    // Stats: cache-aside with 2-min TTL
    const statsPromise = CacheService.getOrSet(
      CACHE_KEYS.DASHBOARD_STATS(userId),
      CacheService.TTL.DASHBOARD_STATS,
      () => AnalyticsModel.getDashboardStats(userId)
    );

    // Accounts: cache-aside with 1-min TTL
    const accountsPromise = CacheService.getOrSet(
      CACHE_KEYS.USER_ACCOUNTS(userId),
      CacheService.TTL.USER_ACCOUNTS,
      () => AccountModel.findByUserId(userId)
    );

    // Recent transactions: always fresh (not cached)
    const recentPromise = TransactionModel.getRecentByUserId(userId, 5);

    // Execute all in parallel
    const [stats, accounts, recentTransactions] = await Promise.all([
      statsPromise,
      accountsPromise,
      recentPromise,
    ]);

    return { stats, recentTransactions, accounts };
  },

  /**
   * Get monthly spending data for charts.
   * Cached with 3-min TTL under the analytics key.
   *
   * @param {string} userId - User UUID
   * @param {number} months - Look-back period
   * @returns {Array}
   */
  async getMonthlySpending(userId, months = 6) {
    const cacheKey = `${CACHE_KEYS.ANALYTICS(userId)}:spending:${months}`;

    return CacheService.getOrSet(
      cacheKey,
      CacheService.TTL.ANALYTICS,
      () => AnalyticsModel.getMonthlySpending(userId, months)
    );
  },

  /**
   * Get transaction trends for charts.
   * Cached with 3-min TTL.
   *
   * @param {string} userId - User UUID
   * @param {number} days   - Look-back period
   * @returns {Array}
   */
  async getTransactionTrends(userId, days = 30) {
    const cacheKey = `${CACHE_KEYS.ANALYTICS(userId)}:trends:${days}`;

    return CacheService.getOrSet(
      cacheKey,
      CacheService.TTL.ANALYTICS,
      () => AnalyticsModel.getTransactionTrends(userId, days)
    );
  },

  /**
   * Get top recipients for pie chart.
   * Cached with 3-min TTL.
   *
   * @param {string} userId - User UUID
   * @param {number} limit  - Max recipients
   * @returns {Array}
   */
  async getTopRecipients(userId, limit = 5) {
    const cacheKey = `${CACHE_KEYS.ANALYTICS(userId)}:recipients:${limit}`;

    return CacheService.getOrSet(
      cacheKey,
      CacheService.TTL.ANALYTICS,
      () => AnalyticsModel.getTopRecipients(userId, limit)
    );
  },

  /**
   * Get fraud statistics for dashboard widget.
   * Short TTL (1 min) because fraud flags change more frequently.
   *
   * @param {string} userId - User UUID
   * @returns {object}
   */
  async getFraudStats(userId) {
    const cacheKey = `${CACHE_KEYS.ANALYTICS(userId)}:fraud`;

    return CacheService.getOrSet(
      cacheKey,
      60, // 1 minute
      () => AnalyticsModel.getFraudStats(userId)
    );
  },
};

module.exports = AnalyticsService;
