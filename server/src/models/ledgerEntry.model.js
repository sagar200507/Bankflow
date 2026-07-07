/**
 * ═══════════════════════════════════════════════════════════════
 *  Ledger Entry Model — Data Access Layer
 * ═══════════════════════════════════════════════════════════════
 */
const pool = require('../config/database');

const LedgerEntryModel = {
  /**
   * Create a new ledger entry.
   * Must be called INSIDE a database transaction (BEGIN/COMMIT).
   *
   * @param {object} client - PG client (transactional)
   * @param {object} data
   * @param {string} data.transactionId - UUID of the business event
   * @param {string} data.accountId     - UUID of the affected account
   * @param {string} data.entryType     - 'DEBIT' | 'CREDIT'
   * @param {number} data.amount        - Amount
   * @param {number} data.balanceAfter  - Account balance after entry
   * @param {string} data.description   - Human-readable description
   * @returns {object} Created ledger entry row
   */
  async create(client, {
    transactionId,
    accountId,
    entryType,
    amount,
    balanceAfter,
    description,
  }) {
    const { rows } = await client.query(
      `INSERT INTO ledger_entries
        (transaction_id, account_id, entry_type, amount, balance_after, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        transactionId,
        accountId,
        entryType,
        amount,
        balanceAfter,
        description || null,
      ]
    );
    return rows[0];
  }
};

module.exports = LedgerEntryModel;
