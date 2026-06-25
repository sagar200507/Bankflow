/**
 * ═══════════════════════════════════════════════════════════════
 *  Analytics Model — Data Access Layer
 * ═══════════════════════════════════════════════════════════════
 *
 * Calls the stored functions created in Phase 6 (analytics + fraud).
 * Each method maps to a PostgreSQL function:
 *   getDashboardStats   → fn_dashboard_stats()
 *   getMonthlySpending  → fn_monthly_spending()
 *   getTransactionTrends→ fn_transaction_trends()
 *   getTopRecipients    → fn_top_recipients()
 * ═══════════════════════════════════════════════════════════════
 */
const pool = require('../config/database');

const AnalyticsModel = {
  /**
   * Get all dashboard KPI stats in one DB call.
   * Calls fn_dashboard_stats(user_id) → JSONB result.
   *
   * @param {string} userId - User UUID
   * @returns {object} { total_balance, account_count, total_transactions, ... }
   */
  async getDashboardStats(userId) {
    const { rows } = await pool.query(
      `SELECT fn_dashboard_stats($1) AS stats`,
      [userId]
    );
    return rows[0]?.stats || {};
  },

  /**
   * Get monthly spending breakdown.
   * Calls fn_monthly_spending(user_id, months) → table result.
   *
   * @param {string} userId - User UUID
   * @param {number} months - Number of months to look back (default: 6)
   * @returns {Array} [{ month, total_spent, txn_count, pct_change }]
   */
  async getMonthlySpending(userId, months = 6) {
    const { rows } = await pool.query(
      `SELECT * FROM fn_monthly_spending($1, $2)`,
      [userId, months]
    );
    return rows;
  },

  /**
   * Get daily transaction trends.
   * Calls fn_transaction_trends(user_id, days) → table result.
   *
   * @param {string} userId - User UUID
   * @param {number} days   - Number of days to look back (default: 30)
   * @returns {Array} [{ day, txn_count, total_amount, cumulative_count, avg_amount }]
   */
  async getTransactionTrends(userId, days = 30) {
    const { rows } = await pool.query(
      `SELECT * FROM fn_transaction_trends($1, $2)`,
      [userId, days]
    );
    return rows;
  },

  /**
   * Get top transaction recipients.
   * Calls fn_top_recipients(user_id, limit) → table result.
   *
   * @param {string} userId - User UUID
   * @param {number} limit  - Max recipients (default: 5)
   * @returns {Array} [{ recipient_name, account_number, total_amount, txn_count, rank }]
   */
  async getTopRecipients(userId, limit = 5) {
    const { rows } = await pool.query(
      `SELECT * FROM fn_top_recipients($1, $2)`,
      [userId, limit]
    );
    return rows;
  },

  /**
   * Get fraud statistics for a user.
   * Raw SQL query (no stored function — simple enough for inline).
   *
   * @param {string} userId - User UUID
   * @returns {object} { total, unresolved, by_severity, by_type }
   */
  async getFraudStats(userId) {
    const totalResult = await pool.query(
      `SELECT COUNT(*)::int AS total,
              SUM(CASE WHEN is_resolved = FALSE THEN 1 ELSE 0 END)::int AS unresolved
       FROM fraud_flags
       WHERE user_id = $1`,
      [userId]
    );

    const bySeverity = await pool.query(
      `SELECT severity, COUNT(*)::int AS count
       FROM fraud_flags
       WHERE user_id = $1
       GROUP BY severity
       ORDER BY
         CASE severity
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low' THEN 4
         END`,
      [userId]
    );

    const byType = await pool.query(
      `SELECT flag_type, COUNT(*)::int AS count
       FROM fraud_flags
       WHERE user_id = $1
       GROUP BY flag_type
       ORDER BY count DESC`,
      [userId]
    );

    return {
      total: totalResult.rows[0]?.total || 0,
      unresolved: totalResult.rows[0]?.unresolved || 0,
      bySeverity: bySeverity.rows,
      byType: byType.rows,
    };
  },
};

module.exports = AnalyticsModel;
