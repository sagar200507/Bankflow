/**
 * ═══════════════════════════════════════════════════════════════
 *  Transaction Service — Business Logic Layer
 * ═══════════════════════════════════════════════════════════════
 *
 * Handles fund transfers and transaction history retrieval.
 *
 * Transfer is the most complex operation in the system:
 *   1. Validate both accounts exist and are active
 *   2. Verify sender ownership
 *   3. Check sufficient balance
 *   4. Lock BOTH accounts (in consistent order to prevent deadlocks)
 *   5. Debit sender, credit receiver
 *   6. Create transaction record
 *   7. All inside a single ACID transaction
 *
 * DEADLOCK PREVENTION:
 *   If Transfer A locks Account 1 then tries to lock Account 2,
 *   and Transfer B locks Account 2 then tries to lock Account 1,
 *   both are stuck waiting forever — DEADLOCK.
 *
 *   Solution: Always lock accounts in ascending UUID order.
 *   Both transfers will try Account 1 first → one waits, no deadlock.
 * ═══════════════════════════════════════════════════════════════
 */
const pool = require('../config/database');
const AccountModel = require('../models/account.model');
const TransactionModel = require('../models/transaction.model');
const LedgerEntryModel = require('../models/ledgerEntry.model');
const FraudDetectionService = require('./fraud.service');
const CacheService = require('./cache.service');
const ApiError = require('../utils/ApiError');
const { generateReferenceNumber } = require('../utils/helpers');
const logger = require('../utils/logger');

const TransactionService = {
  /**
   * Transfer funds between two accounts.
   *
   * @param {object} params
   * @param {string} params.fromAccountId - Sender account UUID
   * @param {string} params.toAccountId   - Receiver account UUID
   * @param {number} params.amount        - Transfer amount (positive)
   * @param {string} params.description   - Optional description
   * @param {string} params.userId        - Authenticated user UUID
   * @param {string} params.ipAddress     - Client IP
   * @returns {{ transaction: object, fromAccount: object, toAccount: object }}
   */
  async transfer({ fromAccountId, toAccountId, amount, description, userId, ipAddress }) {
    // ── Resolve Account Number to UUID ───────────────────────
    // If the user entered a 12-digit account number instead of a UUID, resolve it first
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(toAccountId)) {
      const targetAccount = await AccountModel.findByAccountNumber(toAccountId);
      if (!targetAccount) {
        throw ApiError.badRequest('Destination account not found. Please check the account number and try again.');
      }
      toAccountId = targetAccount.id;
    }

    // ── Pre-validation (outside transaction for fast failure) ──
    if (fromAccountId === toAccountId) {
      throw ApiError.badRequest('Cannot transfer to the same account');
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // ── DEADLOCK PREVENTION ────────────────────────────────
      // Sort UUIDs to ensure consistent lock ordering.
      // UUID comparison uses lexicographic ordering.
      const [firstId, secondId] = fromAccountId < toAccountId
        ? [fromAccountId, toAccountId]
        : [toAccountId, fromAccountId];

      // Lock both accounts in the same order every time
      const firstAccount = await AccountModel.findByIdForUpdate(client, firstId);
      const secondAccount = await AccountModel.findByIdForUpdate(client, secondId);

      // Map back to from/to after sorted locking
      const fromAccount = firstId === fromAccountId ? firstAccount : secondAccount;
      const toAccount = firstId === toAccountId ? firstAccount : secondAccount;

      // ── Validate accounts ──────────────────────────────────
      if (!fromAccount) {
        throw ApiError.notFound('Source account not found');
      }
      if (!toAccount) {
        throw ApiError.notFound('Destination account not found');
      }

      // ── Verify ownership ──────────────────────────────────
      if (fromAccount.user_id !== userId) {
        throw ApiError.forbidden('You do not own the source account');
      }

      // ── Check account statuses ─────────────────────────────
      if (fromAccount.status !== 'active') {
        throw ApiError.badRequest(`Source account is ${fromAccount.status}`);
      }
      if (toAccount.status !== 'active') {
        throw ApiError.badRequest(`Destination account is ${toAccount.status}`);
      }

      // ── Check currency match ───────────────────────────────
      if (fromAccount.currency !== toAccount.currency) {
        throw ApiError.badRequest(
          `Currency mismatch: ${fromAccount.currency} → ${toAccount.currency}. Cross-currency transfers are not supported.`
        );
      }

      // ── Check sufficient balance ───────────────────────────
      const senderBalance = parseFloat(fromAccount.balance);
      if (senderBalance < amount) {
        throw ApiError.badRequest(
          `Insufficient funds. Available: ₹${senderBalance.toFixed(2)}, Requested: ₹${amount.toFixed(2)}`
        );
      }

      // ── Execute transfer ───────────────────────────────────
      const newSenderBalance = senderBalance - amount;
      const newReceiverBalance = parseFloat(toAccount.balance) + amount;

      const updatedFrom = await AccountModel.updateBalance(
        client, fromAccountId, newSenderBalance
      );
      const updatedTo = await AccountModel.updateBalance(
        client, toAccountId, newReceiverBalance
      );

      // ── Create transaction record ──────────────────────────
      const transaction = await TransactionModel.create(client, {
        fromAccountId,
        toAccountId,
        type: 'transfer',
        amount,
        currency: fromAccount.currency,
        status: 'completed',
        description: description || 'Fund transfer',
        referenceNumber: generateReferenceNumber(),
        ipAddress,
        balanceAfter: newSenderBalance,
      });

      // ── Create ledger entries ──────────────────────────────
      await LedgerEntryModel.create(client, {
        transactionId: transaction.id,
        accountId: fromAccountId,
        entryType: 'DEBIT',
        amount,
        balanceAfter: newSenderBalance,
        description: `Transfer to ${toAccount.account_number}`,
      });

      await LedgerEntryModel.create(client, {
        transactionId: transaction.id,
        accountId: toAccountId,
        entryType: 'CREDIT',
        amount,
        balanceAfter: newReceiverBalance,
        description: `Transfer from ${fromAccount.account_number}`,
      });

      await client.query('COMMIT');

      logger.info('Transfer completed', {
        txnId: transaction.id,
        from: fromAccountId,
        to: toAccountId,
        amount,
      });

      // ── Fire-and-forget fraud analysis ───────────────────
      // Transfers are the highest-risk operation, so all 4
      // checks run: velocity, anomaly, geo, large-transaction.
      FraudDetectionService.analyzeTransaction({
        transactionId: transaction.id,
        userId,
        amount,
        type: 'transfer',
        ipAddress,
      }).catch((err) => logger.error('Fraud analysis failed (transfer)', { error: err.message }));

      // ── Invalidate cache for BOTH users ─────────────────
      // Transfers affect two accounts — both users' dashboards,
      // balances, and transaction histories are now stale.
      CacheService.invalidateTransaction(
        userId, fromAccountId,
        toAccount.user_id, toAccountId
      ).catch((err) => logger.error('Cache invalidation failed', { error: err.message }));

      return {
        transaction,
        fromAccount: updatedFrom,
        toAccount: updatedTo,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Get transaction history for a specific account.
   *
   * @param {string} accountId - Account UUID
   * @param {string} userId    - Requesting user UUID (ownership check)
   * @param {object} options   - { page, limit }
   * @returns {{ transactions, total, page, limit }}
   */
  async getAccountTransactions(accountId, userId, options) {
    // Verify account ownership
    const account = await AccountModel.findById(accountId);
    if (!account) {
      throw ApiError.notFound('Account not found');
    }
    if (account.user_id !== userId) {
      throw ApiError.forbidden('You do not own this account');
    }

    return TransactionModel.findByAccountId(accountId, options);
  },

  /**
   * Get all transactions for a user (across all accounts).
   *
   * @param {string} userId - User UUID
   * @param {object} options - { page, limit }
   * @returns {{ transactions, total, page, limit }}
   */
  async getUserTransactions(userId, options) {
    return TransactionModel.findByUserId(userId, options);
  },

  /**
   * Get a single transaction by ID.
   *
   * @param {string} transactionId - Transaction UUID
   * @param {string} userId        - Requesting user UUID
   * @returns {object} Transaction
   */
  async getTransactionById(transactionId, userId) {
    const transaction = await TransactionModel.findById(transactionId);

    if (!transaction) {
      throw ApiError.notFound('Transaction not found');
    }

    // Verify the user is involved in this transaction
    // (either as sender or receiver)
    const isFromOwner = transaction.from_account_id
      ? (await AccountModel.findById(transaction.from_account_id))?.user_id === userId
      : false;
    const isToOwner = transaction.to_account_id
      ? (await AccountModel.findById(transaction.to_account_id))?.user_id === userId
      : false;

    if (!isFromOwner && !isToOwner) {
      throw ApiError.forbidden('You are not authorized to view this transaction');
    }

    return transaction;
  },
};

module.exports = TransactionService;
