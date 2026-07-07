/**
 * ═══════════════════════════════════════════════════════════════
 *  Account Service — Business Logic Layer
 * ═══════════════════════════════════════════════════════════════
 *
 * Business logic for account operations:
 *   • Create account (with account number generation)
 *   • List user accounts
 *   • Deposit funds (ACID transaction)
 *   • Withdraw funds (ACID transaction with balance check)
 *
 * Every balance-mutating operation (deposit, withdraw) uses a
 * PostgreSQL transaction with row-level locking:
 *   BEGIN → SELECT ... FOR UPDATE → UPDATE balance → INSERT txn → COMMIT
 *
 * This guarantees:
 *   • Atomicity: balance + transaction record are updated together
 *   • Isolation: concurrent operations are serialized per-row
 *   • Consistency: CHECK(balance >= 0) enforced by PG
 * ═══════════════════════════════════════════════════════════════
 */
const pool = require('../config/database');
const AccountModel = require('../models/account.model');
const TransactionModel = require('../models/transaction.model');
const LedgerEntryModel = require('../models/ledgerEntry.model');
const FraudDetectionService = require('./fraud.service');
const CacheService = require('./cache.service');
const ApiError = require('../utils/ApiError');
const { generateAccountNumber, generateReferenceNumber } = require('../utils/helpers');
const logger = require('../utils/logger');

const MAX_ACCOUNTS_PER_USER = 5;

const AccountService = {
  /**
   * Create a new bank account for a user.
   *
   * Flow:
   *   1. Check max accounts limit (5 per user)
   *   2. Generate a unique 12-digit account number
   *   3. Insert account record
   *
   * @param {string} userId - UUID of the account owner
   * @param {string} accountType - 'savings' | 'checking' | 'business'
   * @param {string} currency - ISO currency code (default: 'INR')
   * @returns {object} Created account
   */
  async createAccount(userId, accountType, currency) {
    // ── 1. Check limit ───────────────────────────────────────
    const count = await AccountModel.countByUserId(userId);
    if (count >= MAX_ACCOUNTS_PER_USER) {
      throw ApiError.badRequest(
        `Maximum ${MAX_ACCOUNTS_PER_USER} accounts per user. You have ${count}.`
      );
    }

    // ── 2. Generate account number ───────────────────────────
    // Retry logic in case of (astronomically unlikely) collision
    let accountNumber;
    let attempts = 0;
    while (attempts < 3) {
      accountNumber = generateAccountNumber();
      const existing = await AccountModel.findByAccountNumber(accountNumber);
      if (!existing) break;
      attempts++;
    }

    if (attempts >= 3) {
      throw ApiError.internal('Failed to generate unique account number');
    }

    // ── 3. Create account ────────────────────────────────────
    const account = await AccountModel.create({
      userId,
      accountNumber,
      accountType,
      currency,
    });

    logger.info('Account created', {
      accountId: account.id,
      userId,
      accountType,
    });

    // Invalidate user's account list and dashboard cache
    CacheService.invalidateUser(userId)
      .catch((err) => logger.error('Cache invalidation failed', { error: err.message }));

    return account;
  },

  /**
   * Get all accounts for a user.
   *
   * @param {string} userId - UUID
   * @returns {Array} List of accounts
   */
  async getUserAccounts(userId) {
    return AccountModel.findByUserId(userId);
  },

  /**
   * Get a single account by ID with ownership verification.
   *
   * @param {string} accountId - Account UUID
   * @param {string} userId    - Requesting user's UUID
   * @returns {object} Account
   */
  async getAccountById(accountId, userId) {
    const account = await AccountModel.findById(accountId);

    if (!account) {
      throw ApiError.notFound('Account not found');
    }

    // Verify ownership (unless admin)
    if (account.user_id !== userId) {
      throw ApiError.forbidden('You do not own this account');
    }

    return account;
  },

  /**
   * Deposit funds into an account.
   *
   * ACID Transaction:
   *   BEGIN
   *     1. Lock account row (FOR UPDATE)
   *     2. Validate account status
   *     3. Calculate new balance
   *     4. Update balance
   *     5. Create transaction record
   *   COMMIT
   *
   * If ANY step fails, the entire operation rolls back.
   *
   * @param {string} accountId   - Destination account UUID
   * @param {string} userId      - Requesting user's UUID (ownership check)
   * @param {number} amount      - Deposit amount (positive)
   * @param {string} description - Optional description
   * @param {string} ipAddress   - Client IP
   * @returns {{ account: object, transaction: object }}
   */
  async deposit(accountId, userId, amount, description, ipAddress) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // ── 1. Lock account row ──────────────────────────────
      const account = await AccountModel.findByIdForUpdate(client, accountId);

      if (!account) {
        throw ApiError.notFound('Account not found');
      }

      if (account.user_id !== userId) {
        throw ApiError.forbidden('You do not own this account');
      }

      // ── 2. Validate status ───────────────────────────────
      if (account.status !== 'active') {
        throw ApiError.badRequest(`Cannot deposit to a ${account.status} account`);
      }

      // ── 3. Calculate new balance ─────────────────────────
      const newBalance = parseFloat(account.balance) + amount;

      // ── 4. Update balance ────────────────────────────────
      const updatedAccount = await AccountModel.updateBalance(
        client, accountId, newBalance
      );

      // ── 5. Create transaction record ─────────────────────
      const transaction = await TransactionModel.create(client, {
        fromAccountId: null, // Deposits have no source account
        toAccountId: accountId,
        type: 'deposit',
        amount,
        currency: account.currency,
        status: 'completed',
        description: description || 'Account deposit',
        referenceNumber: generateReferenceNumber(),
        ipAddress,
        balanceAfter: newBalance,
      });

      // ── Create ledger entry ──────────────────────────────
      await LedgerEntryModel.create(client, {
        transactionId: transaction.id,
        accountId: accountId,
        entryType: 'CREDIT',
        amount,
        balanceAfter: newBalance,
        description: 'Cash Deposit',
      });

      await client.query('COMMIT');

      logger.info('Deposit completed', {
        accountId,
        amount,
        newBalance,
        txnId: transaction.id,
      });

      // ── Fire-and-forget fraud analysis ───────────────────
      // Runs AFTER commit so fraud check failures don't
      // affect the (already successful) deposit.
      FraudDetectionService.analyzeTransaction({
        transactionId: transaction.id,
        userId,
        amount,
        type: 'deposit',
        ipAddress,
      }).catch((err) => logger.error('Fraud analysis failed (deposit)', { error: err.message }));

      // ── Invalidate cache ───────────────────────────────────
      CacheService.invalidateTransaction(userId, accountId)
        .catch((err) => logger.error('Cache invalidation failed', { error: err.message }));

      return { account: updatedAccount, transaction };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Withdraw funds from an account.
   *
   * Same ACID transaction pattern as deposit, with an additional
   * balance sufficiency check BEFORE updating:
   *   if (currentBalance < amount) → throw insufficient funds
   *
   * The DB CHECK constraint (balance >= 0) is a safety net, but
   * checking in code gives a better error message.
   *
   * @param {string} accountId   - Source account UUID
   * @param {string} userId      - Requesting user's UUID
   * @param {number} amount      - Withdrawal amount (positive)
   * @param {string} description - Optional description
   * @param {string} ipAddress   - Client IP
   * @returns {{ account: object, transaction: object }}
   */
  async withdraw(accountId, userId, amount, description, ipAddress) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // ── 1. Lock account row ──────────────────────────────
      const account = await AccountModel.findByIdForUpdate(client, accountId);

      if (!account) {
        throw ApiError.notFound('Account not found');
      }

      if (account.user_id !== userId) {
        throw ApiError.forbidden('You do not own this account');
      }

      // ── 2. Validate status ───────────────────────────────
      if (account.status !== 'active') {
        throw ApiError.badRequest(`Cannot withdraw from a ${account.status} account`);
      }

      // ── 3. Check sufficient balance ──────────────────────
      const currentBalance = parseFloat(account.balance);
      if (currentBalance < amount) {
        throw ApiError.badRequest(
          `Insufficient funds. Available: ₹${currentBalance.toFixed(2)}, Requested: ₹${amount.toFixed(2)}`
        );
      }

      // ── 4. Calculate and update ──────────────────────────
      const newBalance = currentBalance - amount;
      const updatedAccount = await AccountModel.updateBalance(
        client, accountId, newBalance
      );

      // ── 5. Create transaction record ─────────────────────
      const transaction = await TransactionModel.create(client, {
        fromAccountId: accountId,
        toAccountId: null, // Withdrawals have no destination account
        type: 'withdrawal',
        amount,
        currency: account.currency,
        status: 'completed',
        description: description || 'Account withdrawal',
        referenceNumber: generateReferenceNumber(),
        ipAddress,
        balanceAfter: newBalance,
      });

      // ── Create ledger entry ──────────────────────────────
      await LedgerEntryModel.create(client, {
        transactionId: transaction.id,
        accountId: accountId,
        entryType: 'DEBIT',
        amount,
        balanceAfter: newBalance,
        description: 'Cash Withdrawal',
      });

      await client.query('COMMIT');

      logger.info('Withdrawal completed', {
        accountId,
        amount,
        newBalance,
        txnId: transaction.id,
      });

      // ── Fire-and-forget fraud analysis ───────────────────
      FraudDetectionService.analyzeTransaction({
        transactionId: transaction.id,
        userId,
        amount,
        type: 'withdrawal',
        ipAddress,
      }).catch((err) => logger.error('Fraud analysis failed (withdrawal)', { error: err.message }));

      // ── Invalidate cache ───────────────────────────────────
      CacheService.invalidateTransaction(userId, accountId)
        .catch((err) => logger.error('Cache invalidation failed', { error: err.message }));

      return { account: updatedAccount, transaction };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
};

module.exports = AccountService;
