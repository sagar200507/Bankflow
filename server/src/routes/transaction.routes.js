/**
 * ═══════════════════════════════════════════════════════════════
 *  Transaction Routes
 * ═══════════════════════════════════════════════════════════════
 *
 * All routes require authentication.
 * ═══════════════════════════════════════════════════════════════
 */
const express = require('express');
const TransactionController = require('../controllers/transaction.controller');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// ── All transaction routes require authentication ────────────
router.use(authenticate);

/**
 * POST /api/v1/transactions/transfer
 * Transfer funds between two accounts.
 * Body: { fromAccountId, toAccountId, amount, description? }
 */
router.post(
  '/transfer',
  validate.transfer,
  validate.handleErrors,
  TransactionController.transfer
);

/**
 * GET /api/v1/transactions
 * Get all transactions for the authenticated user.
 * Query: ?page=1&limit=20
 */
router.get(
  '/',
  validate.pagination,
  validate.handleErrors,
  TransactionController.getUserTransactions
);

/**
 * GET /api/v1/transactions/account/:id
 * Get transactions for a specific account.
 * Query: ?page=1&limit=20
 */
router.get(
  '/account/:id',
  validate.uuidParam,
  validate.pagination,
  validate.handleErrors,
  TransactionController.getAccountTransactions
);

/**
 * GET /api/v1/transactions/:id
 * Get a single transaction by ID.
 */
router.get(
  '/:id',
  validate.uuidParam,
  validate.handleErrors,
  TransactionController.getById
);

module.exports = router;
