/**
 * ═══════════════════════════════════════════════════════════════
 *  Auth Controller — HTTP Request Handlers
 * ═══════════════════════════════════════════════════════════════
 *
 * THIN controller pattern:
 *   1. Extract data from req (body, params, headers)
 *   2. Call the service layer
 *   3. Send the response
 *
 * Controllers NEVER contain:
 *   • SQL queries (that's the model's job)
 *   • Business logic (that's the service's job)
 *   • Direct bcrypt/JWT calls (that's the service/utility's job)
 *
 * Every handler is wrapped in catchAsync() so rejected promises
 * are automatically forwarded to the global error handler.
 * ═══════════════════════════════════════════════════════════════
 */
const AuthService = require('../services/auth.service');
const { successResponse } = require('../utils/response');
const catchAsync = require('../utils/catchAsync');
const { createAuditLog, getClientIp } = require('../middleware/audit');

const AuthController = {
  /**
   * POST /api/v1/auth/register
   *
   * Registers a new user account.
   * Request body: { email, password, firstName, lastName, phone? }
   * Response: 201 + user data + tokens
   */
  register: catchAsync(async (req, res) => {
    const { email, password, firstName, lastName, phone } = req.body;

    const { user, tokens } = await AuthService.register({
      email,
      password,
      firstName,
      lastName,
      phone,
    });

    // ── Audit log ────────────────────────────────────────────
    await createAuditLog({
      userId: user.id,
      action: 'user.register',
      entityType: 'user',
      entityId: user.id,
      newValues: { email: user.email, role: user.role },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent'),
    });

    return successResponse(res, 201, 'Registration successful', {
      user,
      ...tokens,
    });
  }),

  /**
   * POST /api/v1/auth/login
   *
   * Authenticates a user with email and password.
   * Request body: { email, password }
   * Response: 200 + user data + tokens
   */
  login: catchAsync(async (req, res) => {
    const { email, password } = req.body;
    const ip = getClientIp(req);

    const { user, tokens } = await AuthService.login(email, password, ip);

    // ── Audit log ────────────────────────────────────────────
    await createAuditLog({
      userId: user.id,
      action: 'user.login',
      entityType: 'user',
      entityId: user.id,
      newValues: { ip, loginAt: new Date().toISOString() },
      ipAddress: ip,
      userAgent: req.get('user-agent'),
    });

    return successResponse(res, 200, 'Login successful', {
      user,
      ...tokens,
    });
  }),

  /**
   * POST /api/v1/auth/refresh
   *
   * Issues a new access+refresh token pair using a valid refresh token.
   * Request body: { refreshToken }
   * Response: 200 + user data + new tokens
   */
  refresh: catchAsync(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required',
      });
    }

    const { user, tokens } = await AuthService.refreshToken(refreshToken);

    return successResponse(res, 200, 'Token refreshed successfully', {
      user,
      ...tokens,
    });
  }),

  /**
   * POST /api/v1/auth/logout
   *
   * Client-side logout — clears tokens from storage.
   * In a production system, you'd also:
   *   • Add the refresh token to a Redis blacklist
   *   • Set TTL = remaining time until token expiry
   *   • Check the blacklist in the refresh endpoint
   *
   * Response: 200 + confirmation message
   */
  logout: catchAsync(async (req, res) => {
    // ── Audit log ────────────────────────────────────────────
    await createAuditLog({
      userId: req.user.id,
      action: 'user.logout',
      entityType: 'user',
      entityId: req.user.id,
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent'),
    });

    return successResponse(res, 200, 'Logout successful');
  }),

  /**
   * GET /api/v1/auth/me
   *
   * Returns the authenticated user's profile.
   * The user is already verified by the auth middleware —
   * req.user contains the JWT payload.
   *
   * Response: 200 + user profile
   */
  getMe: catchAsync(async (req, res) => {
    const user = await AuthService.getProfile(req.user.id);

    return successResponse(res, 200, 'Profile retrieved', { user });
  }),
};

module.exports = AuthController;
