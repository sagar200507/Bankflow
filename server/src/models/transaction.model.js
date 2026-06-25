/**
 * ═══════════════════════════════════════════════════════════════
 *  Transaction Model — Data Access Layer
 * ═══════════════════════════════════════════════════════════════
 *
 * All SQL queries related to the `transactions` table.
 *
 * Key design:
 *   • Transactions are APPEND-ONLY (no UPDATE on amount/type)
 *   • Status can change: pending → completed/failed/reversed
 *   • create() accepts a PG client for transactional use
 *   • History queries use window functions for analytics
 * ═══════════════════════════════════════════════════════════════
 */
const pool = require('../config/database');
const { PAGINATION } = require('../utils/constants');

const TransactionModel = {
  /**
   * Create a new transaction record.
   * Called INSIDE a database transaction (BEGIN/COMMIT) along with
   * balance updates — ensures atomicity.
   *
   * @param {object} client - PG client (transactional)
   * @param {object} data   - Transaction data
   * @returns {object} Created transaction row
   */
  async create(client, {
    fromAccountId,
    toAccountId,
    type,
    amount,
    currency,
    status,
    description,
    referenceNumber,
    ipAddress,
    balanceAfter,
  }) {
    const { rows } = await client.query(
      `INSERT INTO transactions
        (from_account_id, to_account_id, type, amount, currency,
         status, description, reference_number, ip_address, balance_after)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        fromAccountId || null,
        toAccountId || null,
        type,
        amount,
        currency || 'INR',
        status || 'completed',
        description || null,
        referenceNumber,
        ipAddress || null,
        balanceAfter || null,
      ]
    );
    return rows[0];
  },

  /**
   * Find a transaction by ID.
   *
   * @param {string} id - Transaction UUID
   * @returns {object|null}
   */
  async findById(id) {
    const { rows } = await pool.query(
      `SELECT t.*,
              fa.account_number AS from_account_number,
              ta.account_number AS to_account_number
       FROM transactions t
       LEFT JOIN accounts fa ON t.from_account_id = fa.id
       LEFT JOIN accounts ta ON t.to_account_id = ta.id
       WHERE t.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Get transaction history for an account.
   * Returns transactions where the account is EITHER the sender or receiver.
   *
   * Features:
   *   • Pagination with page/limit
   *   • Total count for frontend pagination controls
   *   • Ordered by newest first (created_at DESC)
   *   • Joins account numbers for display
   *
   * @param {string} accountId - Account UUID
   * @param {object} options   - { page, limit }
   * @returns {{ transactions: Array, total: number, page: number, limit: number }}
   */
  async findByAccountId(accountId, { page = 1, limit = PAGINATION.DEFAULT_LIMIT } = {}) {
    const offset = (page - 1) * limit;

    // Count query — needed for pagination metadata
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM transactions
       WHERE from_account_id = $1 OR to_account_id = $1`,
      [accountId]
    );

    // Data query with JOINs for account numbers
    const { rows } = await pool.query(
      `SELECT t.id, t.from_account_id, t.to_account_id,
              t.type, t.amount, t.currency, t.status,
              t.description, t.reference_number, t.balance_after,
              t.ip_address, t.created_at,
              fa.account_number AS from_account_number,
              ta.account_number AS to_account_number,
              fu.first_name || ' ' || fu.last_name AS from_user_name,
              tu.first_name || ' ' || tu.last_name AS to_user_name
       FROM transactions t
       LEFT JOIN accounts fa ON t.from_account_id = fa.id
       LEFT JOIN accounts ta ON t.to_account_id = ta.id
       LEFT JOIN users fu ON fa.user_id = fu.id
       LEFT JOIN users tu ON ta.user_id = tu.id
       WHERE t.from_account_id = $1 OR t.to_account_id = $1
       ORDER BY t.created_at DESC
       LIMIT $2 OFFSET $3`,
      [accountId, limit, offset]
    );

    return {
      transactions: rows,
      total: countResult.rows[0].total,
      page,
      limit,
    };
  },

  /**
   * Get all transactions for a user (across all their accounts).
   * Used for the global transaction history page.
   *
   * @param {string} userId - User UUID
   * @param {object} options - { page, limit }
   * @returns {{ transactions: Array, total: number, page: number, limit: number }}
   */
  async findByUserId(userId, { page = 1, limit = PAGINATION.DEFAULT_LIMIT } = {}) {
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM transactions t
       JOIN accounts a ON (t.from_account_id = a.id OR t.to_account_id = a.id)
       WHERE a.user_id = $1`,
      [userId]
    );

    const { rows } = await pool.query(
      `SELECT DISTINCT ON (t.id)
              t.id, t.from_account_id, t.to_account_id,
              t.type, t.amount, t.currency, t.status,
              t.description, t.reference_number, t.balance_after,
              t.created_at,
              fa.account_number AS from_account_number,
              ta.account_number AS to_account_number,
              fu.first_name || ' ' || fu.last_name AS from_user_name,
              tu.first_name || ' ' || tu.last_name AS to_user_name
       FROM transactions t
       LEFT JOIN accounts fa ON t.from_account_id = fa.id
       LEFT JOIN accounts ta ON t.to_account_id = ta.id
       LEFT JOIN users fu ON fa.user_id = fu.id
       LEFT JOIN users tu ON ta.user_id = tu.id
       WHERE fa.user_id = $1 OR ta.user_id = $1
       ORDER BY t.id, t.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    // Re-sort by created_at since DISTINCT ON requires ORDER BY on t.id first
    rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return {
      transactions: rows,
      total: countResult.rows[0].total,
      page,
      limit,
    };
  },

  /**
   * Get total count of transactions for a user.
   * Used for dashboard KPI cards.
   *
   * @param {string} userId - User UUID
   * @returns {number}
   */
  async countByUserId(userId) {
    const { rows } = await pool.query(
      `SELECT COUNT(DISTINCT t.id)::int AS total
       FROM transactions t
       JOIN accounts a ON (t.from_account_id = a.id OR t.to_account_id = a.id)
       WHERE a.user_id = $1`,
      [userId]
    );
    return rows[0].total;
  },

  /**
   * Get recent transactions for a user (dashboard widget).
   *
   * @param {string} userId - User UUID
   * @param {number} limit  - Number of recent transactions
   * @returns {Array}
   */
  async getRecentByUserId(userId, limit = 5) {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (t.id)
              t.id, t.type, t.amount, t.status,
              t.description, t.reference_number, t.created_at,
              fa.account_number AS from_account_number,
              ta.account_number AS to_account_number,
              tu.first_name || ' ' || tu.last_name AS to_user_name
       FROM transactions t
       LEFT JOIN accounts fa ON t.from_account_id = fa.id
       LEFT JOIN accounts ta ON t.to_account_id = ta.id
       LEFT JOIN users tu ON ta.user_id = tu.id
       WHERE fa.user_id = $1 OR ta.user_id = $1
       ORDER BY t.id, t.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return rows;
  },
};

module.exports = TransactionModel;
