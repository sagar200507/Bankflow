/**
 * ═══════════════════════════════════════════════════════════════
 *  Transaction Routes
 * ═══════════════════════════════════════════════════════════════
 *
 * All routes require authentication.
 * ═══════════════════════════════════════════════════════════════
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const TransactionController = require('../controllers/transaction.controller');
const FraudExplanationController = require('../controllers/fraudExplanation.controller');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// ── Strict Rate Limiters for LLM Endpoints ────────────
const explanationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,              // 5 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    req.rateLimitExceeded = true;
    next();
  }
});

const askLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,             // 10 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Rate limit exceeded for AI Q&A. Please try again later.' }
});

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

/**
 * GET /api/v1/transactions/:id/fraud-explanation
 * Get the AI-generated explanation for a flagged transaction.
 */
router.get(
  '/:id/fraud-explanation',
  explanationLimiter,
  validate.uuidParam,
  validate.handleErrors,
  FraudExplanationController.getExplanation
);

/**
 * POST /api/v1/transactions/:id/fraud-explanation/ask
 * Ask a follow-up question about the flagged transaction.
 * Body: { question: string }
 */
router.post(
  '/:id/fraud-explanation/ask',
  askLimiter,
  validate.uuidParam,
  validate.handleErrors,
  FraudExplanationController.askQuestion
);

module.exports = router;
