/**
 * ═══════════════════════════════════════════════════════════════
 *  Account Routes
 * ═══════════════════════════════════════════════════════════════
 *
 * All routes require authentication.
 * Each route chains: [auth middleware] → [validation] → [controller]
 * ═══════════════════════════════════════════════════════════════
 */
const express = require('express');
const AccountController = require('../controllers/account.controller');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// ── All account routes require authentication ────────────────
router.use(authenticate);

/**
 * POST /api/v1/accounts
 * Create a new bank account.
 * Body: { accountType: 'savings'|'checking'|'business', currency?: 'INR' }
 */
router.post(
  '/',
  validate.createAccount,
  validate.handleErrors,
  AccountController.create
);

/**
 * GET /api/v1/accounts
 * List all accounts for the authenticated user.
 */
router.get('/', AccountController.list);

/**
 * GET /api/v1/accounts/:id
 * Get a single account by ID.
 */
router.get(
  '/:id',
  validate.uuidParam,
  validate.handleErrors,
  AccountController.getById
);

/**
 * POST /api/v1/accounts/:id/deposit
 * Deposit funds into an account.
 * Body: { amount: number, description?: string }
 */
router.post(
  '/:id/deposit',
  validate.uuidParam,
  validate.depositWithdraw,
  validate.handleErrors,
  AccountController.deposit
);

/**
 * POST /api/v1/accounts/:id/withdraw
 * Withdraw funds from an account.
 * Body: { amount: number, description?: string }
 */
router.post(
  '/:id/withdraw',
  validate.uuidParam,
  validate.depositWithdraw,
  validate.handleErrors,
  AccountController.withdraw
);

module.exports = router;
