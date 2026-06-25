/**
 * ═══════════════════════════════════════════════════════════════
 *  Fraud Flag Model — Data Access Layer
 * ═══════════════════════════════════════════════════════════════
 *
 * All SQL queries for the `fraud_flags` table.
 * Also wraps calls to the fraud detection stored functions
 * created in Phase 6 (fn_velocity_check, fn_anomaly_check,
 * fn_geo_consistency_check).
 * ═══════════════════════════════════════════════════════════════
 */
const pool = require('../config/database');
const { PAGINATION } = require('../utils/constants');

const FraudModel = {
  // ══════════════════════════════════════════════════════════
  //  FRAUD FLAG CRUD
  // ══════════════════════════════════════════════════════════

  /**
   * Create a new fraud flag.
   *
   * @param {object} data - Flag data
   * @returns {object} Created fraud flag row
   */
  async create({
    transactionId,
    userId,
    flagType,
    severity,
    description,
    metadata = {},
  }) {
    const { rows } = await pool.query(
      `INSERT INTO fraud_flags
        (transaction_id, user_id, flag_type, severity, description, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [transactionId, userId, flagType, severity, description, JSON.stringify(metadata)]
    );
    return rows[0];
  },

  /**
   * Find a fraud flag by ID.
   *
   * @param {string} id - Fraud flag UUID
   * @returns {object|null}
   */
  async findById(id) {
    const { rows } = await pool.query(
      `SELECT ff.*,
              t.amount AS transaction_amount,
              t.type AS transaction_type,
              t.reference_number,
              t.created_at AS transaction_date,
              u.first_name || ' ' || u.last_name AS user_name,
              u.email AS user_email
       FROM fraud_flags ff
       JOIN transactions t ON ff.transaction_id = t.id
       JOIN users u ON ff.user_id = u.id
       WHERE ff.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Get fraud flags for a user (paginated).
   *
   * @param {string} userId - User UUID
   * @param {object} options - { page, limit, resolved }
   * @returns {{ flags, total, page, limit }}
   */
  async findByUserId(userId, {
    page = PAGINATION.DEFAULT_PAGE,
    limit = PAGINATION.DEFAULT_LIMIT,
    resolved = null,
  } = {}) {
    const offset = (page - 1) * limit;
    const conditions = ['ff.user_id = $1'];
    const params = [userId];
    let paramIdx = 2;

    // Optional filter: resolved/unresolved
    if (resolved !== null) {
      conditions.push(`ff.is_resolved = $${paramIdx++}`);
      params.push(resolved);
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM fraud_flags ff WHERE ${whereClause}`,
      params
    );

    const { rows } = await pool.query(
      `SELECT ff.*,
              t.amount AS transaction_amount,
              t.type AS transaction_type,
              t.reference_number,
              t.created_at AS transaction_date
       FROM fraud_flags ff
       JOIN transactions t ON ff.transaction_id = t.id
       WHERE ${whereClause}
       ORDER BY
         CASE ff.severity
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low' THEN 4
         END,
         ff.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    );

    return {
      flags: rows,
      total: countResult.rows[0].total,
      page,
      limit,
    };
  },

  /**
   * Get all unresolved fraud flags (admin view).
   *
   * @param {object} options - { page, limit }
   * @returns {{ flags, total, page, limit }}
   */
  async findAllUnresolved({ page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM fraud_flags WHERE is_resolved = FALSE`
    );

    const { rows } = await pool.query(
      `SELECT ff.*,
              t.amount AS transaction_amount,
              t.type AS transaction_type,
              t.reference_number,
              u.first_name || ' ' || u.last_name AS user_name,
              u.email AS user_email
       FROM fraud_flags ff
       JOIN transactions t ON ff.transaction_id = t.id
       JOIN users u ON ff.user_id = u.id
       WHERE ff.is_resolved = FALSE
       ORDER BY
         CASE ff.severity
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low' THEN 4
         END,
         ff.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return {
      flags: rows,
      total: countResult.rows[0].total,
      page,
      limit,
    };
  },

  /**
   * Resolve a fraud flag.
   *
   * @param {string} flagId     - Fraud flag UUID
   * @param {string} resolvedBy - Admin user UUID
   * @param {string} note       - Resolution note
   * @returns {object} Updated fraud flag
   */
  async resolve(flagId, resolvedBy, note) {
    const { rows } = await pool.query(
      `UPDATE fraud_flags
       SET is_resolved = TRUE,
           resolved_by = $2,
           resolved_at = NOW(),
           resolution_note = $3
       WHERE id = $1
       RETURNING *`,
      [flagId, resolvedBy, note]
    );
    return rows[0] || null;
  },

  // ══════════════════════════════════════════════════════════
  //  FRAUD DETECTION QUERIES (calling stored functions)
  // ══════════════════════════════════════════════════════════

  /**
   * Run velocity check via stored function.
   * @param {string} userId - User UUID
   * @param {number} windowMinutes - Time window
   * @returns {object} { txn_count, window_start, window_end }
   */
  async velocityCheck(userId, windowMinutes = 5) {
    const { rows } = await pool.query(
      `SELECT * FROM fn_velocity_check($1, $2)`,
      [userId, windowMinutes]
    );
    return rows[0];
  },

  /**
   * Run anomaly check via stored function.
   * @param {string} userId - User UUID
   * @param {number} amount - Transaction amount
   * @param {number} multiplier - Anomaly threshold multiplier
   * @returns {object} { is_anomaly, avg_amount, threshold, given_amount }
   */
  async anomalyCheck(userId, amount, multiplier = 3.0) {
    const { rows } = await pool.query(
      `SELECT * FROM fn_anomaly_check($1, $2, $3)`,
      [userId, amount, multiplier]
    );
    return rows[0];
  },

  /**
   * Run geographic consistency check via stored function.
   * @param {string} userId - User UUID
   * @param {string} ipAddress - Current IP
   * @returns {object} { is_inconsistent, current_ip, recent_ips, match_count }
   */
  async geoCheck(userId, ipAddress) {
    const { rows } = await pool.query(
      `SELECT * FROM fn_geo_consistency_check($1, $2)`,
      [userId, ipAddress]
    );
    return rows[0];
  },
};

module.exports = FraudModel;
