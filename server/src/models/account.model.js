/**
 * ═══════════════════════════════════════════════════════════════
 *  Account Model — Data Access Layer
 * ═══════════════════════════════════════════════════════════════
 *
 * All SQL queries related to the `accounts` table.
 * Every query is parameterized ($1, $2…) to prevent SQL injection.
 *
 * Key patterns:
 *   • findByUserId — returns ALL accounts for a user (dashboard)
 *   • findById     — single account with ownership check
 *   • updateBalance — used internally by deposit/withdraw services
 *     (direct balance update, NOT the stored procedure version —
 *     that comes in Phase 6)
 * ═══════════════════════════════════════════════════════════════
 */
const pool = require('../config/database');

const AccountModel = {
  /**
   * Create a new bank account.
   *
   * @param {object} data - { userId, accountNumber, accountType, currency }
   * @returns {object} Created account row
   */
  async create({ userId, accountNumber, accountType, currency }) {
    const { rows } = await pool.query(
      `INSERT INTO accounts (user_id, account_number, account_type, currency)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, accountNumber, accountType, currency || 'INR']
    );
    return rows[0];
  },

  /**
   * Find all accounts belonging to a user.
   * Used on the dashboard to show account cards.
   *
   * @param {string} userId - UUID
   * @returns {Array} List of account rows
   */
  async findByUserId(userId) {
    const { rows } = await pool.query(
      `SELECT id, user_id, account_number, account_type,
              balance, currency, status, created_at, updated_at
       FROM accounts
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  },

  /**
   * Find a single account by ID.
   *
   * @param {string} id - Account UUID
   * @returns {object|null} Account row or null
   */
  async findById(id) {
    const { rows } = await pool.query(
      `SELECT id, user_id, account_number, account_type,
              balance, currency, status, created_at, updated_at
       FROM accounts
       WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Find an account by account number.
   * Used for transfers where the user provides an account number.
   *
   * @param {string} accountNumber - 12-digit account number
   * @returns {object|null} Account row or null
   */
  async findByAccountNumber(accountNumber) {
    const { rows } = await pool.query(
      `SELECT id, user_id, account_number, account_type,
              balance, currency, status, created_at, updated_at
       FROM accounts
       WHERE account_number = $1`,
      [accountNumber]
    );
    return rows[0] || null;
  },

  /**
   * Find account with row-level lock (FOR UPDATE).
   * Used inside transactions to prevent concurrent balance updates.
   *
   * FOR UPDATE acquires an exclusive row lock:
   *   • Other transactions reading this row WITHOUT FOR UPDATE: allowed
   *   • Other transactions trying FOR UPDATE on this row: BLOCKED until
   *     this transaction commits or rolls back
   *
   * This prevents the classic race condition:
   *   T1: reads balance = 1000
   *   T2: reads balance = 1000
   *   T1: sets balance = 1000 - 500 = 500  (withdraw 500)
   *   T2: sets balance = 1000 - 800 = 200  (withdraw 800)
   *   Result: 500 + 800 = 1300 withdrawn from 1000 balance!
   *
   * With FOR UPDATE:
   *   T1: locks row, reads balance = 1000
   *   T2: WAITS for T1's lock to release
   *   T1: sets balance = 500, COMMITS, releases lock
   *   T2: reads balance = 500 (correct!), sets balance = -300 → CHECK fails
   *
   * @param {object} client - PostgreSQL client from pool (inside a transaction)
   * @param {string} id - Account UUID
   * @returns {object|null} Account row (locked) or null
   */
  async findByIdForUpdate(client, id) {
    const { rows } = await client.query(
      `SELECT id, user_id, account_number, account_type,
              balance, currency, status
       FROM accounts
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Update account balance — used within a transaction.
   * The caller is responsible for wrapping this in BEGIN/COMMIT.
   *
   * @param {object} client - PostgreSQL client (transactional)
   * @param {string} id - Account UUID
   * @param {number} newBalance - The new balance to set
   * @returns {object} Updated account row
   */
  async updateBalance(client, id, newBalance) {
    const { rows } = await client.query(
      `UPDATE accounts SET balance = $2 WHERE id = $1
       RETURNING id, balance, updated_at`,
      [id, newBalance]
    );
    return rows[0];
  },

  /**
   * Update account status (active, frozen, closed).
   *
   * @param {string} id - Account UUID
   * @param {string} status - New status
   * @returns {object} Updated account row
   */
  async updateStatus(id, status) {
    const { rows } = await pool.query(
      `UPDATE accounts SET status = $2 WHERE id = $1
       RETURNING *`,
      [id, status]
    );
    return rows[0] || null;
  },

  /**
   * Count accounts for a user.
   * Used to enforce max accounts limit.
   *
   * @param {string} userId - UUID
   * @returns {number}
   */
  async countByUserId(userId) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM accounts WHERE user_id = $1`,
      [userId]
    );
    return rows[0].total;
  },

  /**
   * Get total balance across all accounts for a user.
   * Used for dashboard KPI cards.
   *
   * @param {string} userId - UUID
   * @returns {number}
   */
  async getTotalBalance(userId) {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(balance), 0)::numeric AS total_balance
       FROM accounts
       WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );
    return parseFloat(rows[0].total_balance);
  },
};

module.exports = AccountModel;
