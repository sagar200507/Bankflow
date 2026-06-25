/**
 * ═══════════════════════════════════════════════════════════════
 *  Fraud Routes
 * ═══════════════════════════════════════════════════════════════
 * All routes require authentication.
 * Resolve requires admin or auditor role.
 * ═══════════════════════════════════════════════════════════════
 */
const express = require('express');
const FraudController = require('../controllers/fraud.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/fraud/flags
 * List fraud flags.
 * Regular users see their own flags.
 * Admins can add ?all=true to see all unresolved flags.
 *
 * Query: ?page=1&limit=20&resolved=false&all=true
 */
router.get(
  '/flags',
  validate.pagination,
  validate.handleErrors,
  FraudController.getFlags
);

/**
 * GET /api/v1/fraud/flags/:id
 * Get a single fraud flag by ID.
 */
router.get(
  '/flags/:id',
  validate.uuidParam,
  validate.handleErrors,
  FraudController.getFlagById
);

/**
 * PATCH /api/v1/fraud/flags/:id/resolve
 * Resolve a fraud flag — admin or auditor only.
 * Body: { note: "Investigation completed, transaction is legitimate" }
 */
router.patch(
  '/flags/:id/resolve',
  authorize('admin', 'auditor'),
  validate.uuidParam,
  validate.handleErrors,
  FraudController.resolveFlag
);

module.exports = router;
