/**
 * ═══════════════════════════════════════════════════════════════
 *  Authentication & Authorization Middleware
 * ═══════════════════════════════════════════════════════════════
 *
 * Two middleware functions:
 *   1. authenticate — verifies the JWT and attaches req.user
 *   2. authorize    — checks if req.user.role is in the allowed list
 *
 * Usage in routes:
 *   // Any authenticated user
 *   router.get('/profile', authenticate, controller.getProfile);
 *
 *   // Only admin users
 *   router.delete('/users/:id', authenticate, authorize('admin'), controller.deleteUser);
 *
 *   // Admin or auditor
 *   router.get('/audit', authenticate, authorize('admin', 'auditor'), controller.getAuditLogs);
 *
 * Token Format:
 *   Authorization: Bearer <access_token>
 *
 * WHY "Bearer"?
 *   The Bearer scheme (RFC 6750) tells the server that whoever
 *   "bears" (carries) this token is authorized. It's the standard
 *   for OAuth 2.0 and JWT-based auth.
 * ═══════════════════════════════════════════════════════════════
 */
const { verifyAccessToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');
const UserModel = require('../models/user.model');
const catchAsync = require('../utils/catchAsync');

/**
 * authenticate — Verifies the JWT access token.
 *
 * Flow:
 *   1. Extract token from "Authorization: Bearer <token>" header
 *   2. Verify token signature and expiry
 *   3. Optionally verify user still exists in DB
 *   4. Attach decoded payload to req.user
 *
 * After this middleware, req.user = { id, email, role }
 */
const authenticate = catchAsync(async (req, res, next) => {
  // ── 1. Extract token ───────────────────────────────────────
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    // Split "Bearer <token>" and take the token part
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    throw ApiError.unauthorized(
      'Authentication required. Please provide a valid token.'
    );
  }

  // ── 2. Verify token ───────────────────────────────────────
  // verifyAccessToken() throws ApiError if invalid/expired
  const decoded = verifyAccessToken(token);

  // ── 3. Verify user still exists ────────────────────────────
  // This is an optional but recommended step:
  //   • If a user is deleted AFTER a token is issued, the token
  //     is still technically valid (correct signature, not expired).
  //   • Without this check, a deleted user could access the API
  //     for up to 15 minutes (token TTL).
  //   • The trade-off is one DB query per request — mitigated by
  //     Redis caching in Phase 8.
  const user = await UserModel.findById(decoded.id);

  if (!user) {
    throw ApiError.unauthorized('User no longer exists');
  }

  if (!user.is_active) {
    throw ApiError.forbidden('Your account has been deactivated');
  }

  // ── 4. Attach user to request ──────────────────────────────
  // Downstream middleware and controllers can access req.user
  req.user = {
    id: decoded.id,
    email: decoded.email,
    role: decoded.role,
  };

  next();
});

/**
 * authorize — Role-based access control (RBAC).
 *
 * Returns a middleware function that checks if the authenticated
 * user's role is in the allowed list.
 *
 * Uses a closure (higher-order function) so roles can be passed
 * as arguments at route definition time:
 *   authorize('admin', 'auditor')  →  returns middleware function
 *
 * @param {...string} roles - Allowed roles (e.g., 'admin', 'user', 'auditor')
 * @returns {function} Express middleware
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    // req.user is set by the authenticate middleware above
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      throw ApiError.forbidden(
        `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`
      );
    }

    next();
  };
};

module.exports = { authenticate, authorize };
