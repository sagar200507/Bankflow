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
       FROM ledger_entries
       WHERE account_id = $1`,
      [accountId]
    );

    // Data query with JOINs for account numbers and transaction metadata
    const { rows } = await pool.query(
      `SELECT le.transaction_id, le.entry_type, le.amount, le.balance_after, 
              COALESCE(le.description, t.description) AS description, le.created_at,
              t.id, t.status, t.currency, t.ip_address,
              t.reference_number, t.type AS transaction_type,
              fa.account_number AS from_account_number,
              ta.account_number AS to_account_number,
              fa.account_type AS from_account_type,
              ta.account_type AS to_account_type,
              fa.user_id AS from_user_id,
              ta.user_id AS to_user_id,
              fu.first_name || ' ' || fu.last_name AS from_user_name,
              tu.first_name || ' ' || tu.last_name AS to_user_name,
              EXISTS (SELECT 1 FROM fraud_flags ff WHERE ff.transaction_id = t.id) AS is_flagged
       FROM ledger_entries le
       JOIN transactions t ON le.transaction_id = t.id
       LEFT JOIN accounts fa ON t.from_account_id = fa.id
       LEFT JOIN accounts ta ON t.to_account_id = ta.id
       LEFT JOIN users fu ON fa.user_id = fu.id
       LEFT JOIN users tu ON ta.user_id = tu.id
       WHERE le.account_id = $1
       ORDER BY le.created_at DESC
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
       FROM ledger_entries le
       JOIN accounts a ON le.account_id = a.id
       WHERE a.user_id = $1`,
      [userId]
    );

    const { rows } = await pool.query(
      `SELECT le.transaction_id, le.entry_type, le.amount, le.balance_after, 
              COALESCE(le.description, t.description) AS description, le.created_at,
              t.id, t.status, t.currency, t.ip_address,
              t.reference_number, t.type AS transaction_type,
              fa.account_number AS from_account_number,
              ta.account_number AS to_account_number,
              fa.account_type AS from_account_type,
              ta.account_type AS to_account_type,
              fa.user_id AS from_user_id,
              ta.user_id AS to_user_id,
              fu.first_name || ' ' || fu.last_name AS from_user_name,
              tu.first_name || ' ' || tu.last_name AS to_user_name,
              EXISTS (SELECT 1 FROM fraud_flags ff WHERE ff.transaction_id = t.id) AS is_flagged
       FROM ledger_entries le
       JOIN transactions t ON le.transaction_id = t.id
       JOIN accounts a ON le.account_id = a.id
       LEFT JOIN accounts fa ON t.from_account_id = fa.id
       LEFT JOIN accounts ta ON t.to_account_id = ta.id
       LEFT JOIN users fu ON fa.user_id = fu.id
       LEFT JOIN users tu ON ta.user_id = tu.id
       WHERE a.user_id = $1
       ORDER BY le.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

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
      `SELECT COUNT(*)::int AS total
       FROM ledger_entries le
       JOIN accounts a ON le.account_id = a.id
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
      `SELECT le.transaction_id, le.entry_type, le.amount, le.balance_after, 
              COALESCE(le.description, t.description) AS description, le.created_at,
              t.id, t.status, t.currency, t.ip_address,
              t.reference_number, t.type AS transaction_type,
              fa.account_number AS from_account_number,
              ta.account_number AS to_account_number,
              fa.account_type AS from_account_type,
              ta.account_type AS to_account_type,
              fa.user_id AS from_user_id,
              ta.user_id AS to_user_id,
              tu.first_name || ' ' || tu.last_name AS to_user_name
       FROM ledger_entries le
       JOIN transactions t ON le.transaction_id = t.id
       JOIN accounts a ON le.account_id = a.id
       LEFT JOIN accounts fa ON t.from_account_id = fa.id
       LEFT JOIN accounts ta ON t.to_account_id = ta.id
       LEFT JOIN users tu ON ta.user_id = tu.id
       WHERE a.user_id = $1
       ORDER BY le.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return rows;
  },
};

module.exports = TransactionModel;
