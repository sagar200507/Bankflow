/**
 * ═══════════════════════════════════════════════════════════════
 *  Auth Routes
 * ═══════════════════════════════════════════════════════════════
 *
 * Defines the authentication API endpoints.
 * Each route follows the pattern:
 *   URL → [validation middleware] → [auth middleware] → controller
 *
 * Middleware chain execution:
 *   POST /register → validate.register → validate.handleErrors → authController.register
 *   POST /login    → validate.login    → validate.handleErrors → authController.login
 *   POST /refresh  → (no validation)   → authController.refresh
 *   POST /logout   → authenticate      → authController.logout
 *   GET  /me       → authenticate      → authController.getMe
 *
 * Public routes (no auth): register, login, refresh
 * Protected routes (JWT required): logout, me
 * ═══════════════════════════════════════════════════════════════
 */
const express = require('express');
const AuthController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// ══════════════════════════════════════════════════════════════
//  PUBLIC ROUTES (no authentication required)
// ══════════════════════════════════════════════════════════════

/**
 * POST /api/v1/auth/register
 *
 * Creates a new user account.
 * Validation ensures: valid email, strong password, name length.
 *
 * Request:  { email, password, firstName, lastName, phone? }
 * Response: 201 { success, data: { user, accessToken, refreshToken } }
 */
router.post(
  '/register',
  validate.register,
  validate.handleErrors,
  AuthController.register
);

/**
 * POST /api/v1/auth/login
 *
 * Authenticates with email + password, returns JWT tokens.
 * Validation is minimal to avoid leaking field requirements.
 *
 * Request:  { email, password }
 * Response: 200 { success, data: { user, accessToken, refreshToken } }
 */
router.post(
  '/login',
  validate.login,
  validate.handleErrors,
  AuthController.login
);

/**
 * POST /api/v1/auth/refresh
 *
 * Issues a new token pair using a valid refresh token.
 * No validation middleware — the JWT library validates the token.
 *
 * Request:  { refreshToken }
 * Response: 200 { success, data: { user, accessToken, refreshToken } }
 */
router.post('/refresh', AuthController.refresh);

// ══════════════════════════════════════════════════════════════
//  PROTECTED ROUTES (JWT required)
// ══════════════════════════════════════════════════════════════

/**
 * POST /api/v1/auth/logout
 *
 * Logs out the authenticated user.
 * In production, would blacklist the refresh token in Redis.
 *
 * Headers:  Authorization: Bearer <access_token>
 * Response: 200 { success, message: 'Logout successful' }
 */
router.post('/logout', authenticate, AuthController.logout);

/**
 * GET /api/v1/auth/me
 *
 * Returns the authenticated user's profile.
 *
 * Headers:  Authorization: Bearer <access_token>
 * Response: 200 { success, data: { user } }
 */
router.get('/me', authenticate, AuthController.getMe);

module.exports = router;
