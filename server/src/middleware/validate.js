/**
 * Validation Middleware
 * ────────────────────
 * Uses express-validator to validate and sanitize request data.
 *
 * WHY express-validator?
 *   • Chain-based API that reads like English:
 *     body('email').isEmail().normalizeEmail()
 *   • Sanitization built-in (trim, escape, normalizeEmail)
 *   • Returns structured error objects for the frontend
 *   • Integrates natively with Express middleware pipeline
 *
 * SECURITY: Input validation is the FIRST line of defense against:
 *   • SQL injection (caught before queries run)
 *   • XSS (HTML entities escaped)
 *   • Buffer overflow (length limits enforced)
 *   • Type confusion (strings → numbers validated)
 *
 * Usage in routes:
 *   router.post('/register',
 *     validate.register,      // validation rules
 *     validate.handleErrors,  // check for errors
 *     authController.register // controller
 *   );
 */
const { body, param, query, validationResult } = require('express-validator');
const { errorResponse } = require('../utils/response');

/**
 * handleErrors — middleware that runs AFTER validation chains.
 * If any validation failed, responds with 400 + error details.
 * If all validations passed, calls next() to proceed.
 */
const handleErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Map to a cleaner format: [{ field, message }]
    const formattedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));

    return errorResponse(res, 400, 'Validation failed', formattedErrors);
  }

  next();
};

// ══════════════════════════════════════════════════════════════
//  VALIDATION RULE SETS
// ══════════════════════════════════════════════════════════════

/**
 * Registration validation
 * • email: must be valid format, normalized (lowercase, remove dots in gmail)
 * • password: 8+ chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
 * • names: 2-100 chars, trimmed
 */
const register = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters'),

  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be 8-128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/)
    .withMessage('Password must include uppercase, lowercase, number, and special character'),

  body('firstName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('First name must be 2-100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),

  body('lastName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Last name must be 2-100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),

  body('phone')
    .optional()
    .trim()
    .matches(/^\+?[\d\s-]{7,20}$/)
    .withMessage('Please provide a valid phone number'),
];

/**
 * Login validation — minimal to avoid leaking info about valid fields
 */
const login = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

/**
 * Account creation validation
 */
const createAccount = [
  body('accountType')
    .isIn(['savings', 'checking', 'business'])
    .withMessage('Account type must be savings, checking, or business'),

  body('currency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be a 3-letter ISO code')
    .isAlpha()
    .withMessage('Currency must contain only letters')
    .toUpperCase(),
];

/**
 * Deposit / Withdrawal validation
 */
const depositWithdraw = [
  body('amount')
    .isFloat({ min: 0.01, max: 10000000 })
    .withMessage('Amount must be between ₹0.01 and ₹1,00,00,000')
    .toFloat(),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters')
    .escape(), // Prevents XSS in stored descriptions
];

/**
 * Transfer validation
 */
const transfer = [
  body('fromAccountId')
    .isUUID(4)
    .withMessage('Invalid source account ID'),

  body('toAccountId')
    .isString()
    .trim()
    .custom((value) => {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
      const isAccountNumber = /^\d{12}$/.test(value);
      if (!isUUID && !isAccountNumber) {
        throw new Error('Destination account ID must be a valid UUID or 12-digit account number');
      }
      return true;
    }),

  body('amount')
    .isFloat({ min: 0.01, max: 10000000 })
    .withMessage('Amount must be between ₹0.01 and ₹1,00,00,000')
    .toFloat(),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters')
    .escape(),
];

/**
 * UUID parameter validation — reusable for any :id param
 */
const uuidParam = [
  param('id')
    .isUUID(4)
    .withMessage('Invalid ID format'),
];

/**
 * Pagination query validation
 */
const pagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
];

module.exports = {
  handleErrors,
  register,
  login,
  createAccount,
  depositWithdraw,
  transfer,
  uuidParam,
  pagination,
};
