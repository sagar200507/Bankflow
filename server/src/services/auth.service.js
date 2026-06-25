/**
 * ═══════════════════════════════════════════════════════════════
 *  Auth Service — Business Logic Layer
 * ═══════════════════════════════════════════════════════════════
 *
 * Contains authentication business logic:
 *   • Registration (hash password, check duplicates, create user)
 *   • Login (verify credentials, generate tokens)
 *   • Token refresh (verify refresh token, issue new pair)
 *
 * This layer sits between the controller and model:
 *   Controller → Service → Model
 *
 * WHY a separate service layer?
 *   • Controllers handle HTTP concerns (req, res, status codes)
 *   • Services handle business rules (password policy, token logic)
 *   • Models handle data access (SQL queries)
 *
 *   This means:
 *   • Business logic can be tested without HTTP (no req/res mocking)
 *   • The same logic can be reused across REST, GraphQL, WebSocket
 *   • Models can be swapped (PG → MongoDB) without touching services
 *
 * SECURITY:
 *   • bcrypt.hash() generates a unique salt per password automatically.
 *     Two users with the same password get different hashes.
 *   • bcrypt.compare() is constant-time (resistant to timing attacks).
 *   • Login errors use generic messages to prevent user enumeration:
 *     "Invalid email or password" — never "Email not found" vs
 *     "Wrong password" (that reveals which emails are registered).
 * ═══════════════════════════════════════════════════════════════
 */
const bcrypt = require('bcrypt');
const config = require('../config');
const UserModel = require('../models/user.model');
const { generateTokenPair } = require('../utils/jwt');
const CacheService = require('./cache.service');
const { CACHE_KEYS } = require('../utils/constants');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

const AuthService = {
  /**
   * Register a new user.
   *
   * Flow:
   *   1. Check if email already exists (clear error before DB constraint)
   *   2. Hash the password with bcrypt
   *   3. Create user in database
   *   4. Generate JWT token pair
   *   5. Return user data + tokens
   *
   * @param {object} userData - { email, password, firstName, lastName, phone }
   * @returns {{ user: object, tokens: { accessToken, refreshToken } }}
   */
  async register({ email, password, firstName, lastName, phone }) {
    // ── 1. Check for existing email ──────────────────────────
    const exists = await UserModel.emailExists(email);
    if (exists) {
      throw ApiError.conflict('An account with this email already exists');
    }

    // ── 2. Hash password ─────────────────────────────────────
    // bcrypt.hash(plaintext, saltRounds):
    //   • Generates a random 16-byte salt
    //   • Runs the Blowfish cipher `2^saltRounds` times
    //   • Returns "$2b$12$<22-char-salt><31-char-hash>"
    //
    // At 12 rounds: ~250ms per hash (intentionally slow).
    // This makes brute-force attacks on stolen hashes infeasible:
    //   10 billion passwords × 250ms = ~79 years on a single core.
    const passwordHash = await bcrypt.hash(password, config.bcryptSaltRounds);

    // ── 3. Create user ───────────────────────────────────────
    const user = await UserModel.create({
      email,
      passwordHash,
      firstName,
      lastName,
      phone,
    });

    // ── 4. Generate tokens ───────────────────────────────────
    const tokens = generateTokenPair({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    logger.info('User registered', { userId: user.id, email: user.email });

    return { user, tokens };
  },

  /**
   * Authenticate a user with email and password.
   *
   * Flow:
   *   1. Find user by email
   *   2. Verify password with bcrypt.compare()
   *   3. Check account is active
   *   4. Update last login timestamp
   *   5. Generate JWT token pair
   *
   * SECURITY: Steps 1-2 use the SAME error message to prevent
   * user enumeration. An attacker can't distinguish between
   * "email doesn't exist" and "wrong password".
   *
   * @param {string} email
   * @param {string} password
   * @param {string} ip - Client IP for audit logging
   * @returns {{ user: object, tokens: { accessToken, refreshToken } }}
   */
  async login(email, password, ip) {
    // ── 1. Find user (includes password_hash) ────────────────
    const user = await UserModel.findByEmail(email);

    if (!user) {
      // Don't reveal that the email doesn't exist
      throw ApiError.unauthorized('Invalid email or password');
    }

    // ── 2. Verify password ───────────────────────────────────
    // bcrypt.compare(plaintext, hash):
    //   • Extracts the salt from the stored hash
    //   • Hashes the plaintext with that salt
    //   • Compares the result (constant-time to prevent timing attacks)
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      // Same error message as above — prevents enumeration
      throw ApiError.unauthorized('Invalid email or password');
    }

    // ── 3. Check account status ──────────────────────────────
    if (!user.is_active) {
      throw ApiError.forbidden('Your account has been deactivated. Contact support.');
    }

    // ── 4. Update last login ─────────────────────────────────
    await UserModel.updateLastLogin(user.id, ip);

    // ── 5. Generate tokens ───────────────────────────────────
    const tokens = generateTokenPair({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // Remove password_hash from the response
    const { password_hash, ...userWithoutPassword } = user;

    logger.info('User logged in', { userId: user.id, ip });

    return { user: userWithoutPassword, tokens };
  },

  /**
   * Refresh the access token using a valid refresh token.
   *
   * Flow:
   *   1. Verify the refresh token (signature + expiry)
   *   2. Fetch the user from DB (ensures they still exist & are active)
   *   3. Generate a new token pair
   *
   * WHY fetch from DB?
   *   The user might have been deactivated or deleted since the
   *   refresh token was issued. Without this check, a deactivated
   *   user could keep refreshing forever.
   *
   * @param {string} refreshToken - The refresh JWT
   * @returns {{ user: object, tokens: { accessToken, refreshToken } }}
   */
  async refreshToken(refreshToken) {
    // ── 1. Verify refresh token ──────────────────────────────
    // verifyRefreshToken() throws ApiError if invalid/expired
    const { verifyRefreshToken } = require('../utils/jwt');
    const decoded = verifyRefreshToken(refreshToken);

    // ── 2. Fetch user from DB ────────────────────────────────
    const user = await UserModel.findById(decoded.id);

    if (!user) {
      throw ApiError.unauthorized('User no longer exists');
    }

    if (!user.is_active) {
      throw ApiError.forbidden('Account has been deactivated');
    }

    // ── 3. Generate new token pair ───────────────────────────
    const tokens = generateTokenPair({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return { user, tokens };
  },

  /**
   * Get the current user's profile.
   * Used by the /auth/me endpoint (protected route).
   *
   * @param {string} userId - UUID from the JWT payload
   * @returns {object} User profile
   */
  async getProfile(userId) {
    // Cache-aside: try Redis first, fall back to PostgreSQL
    const cacheKey = CACHE_KEYS.USER_PROFILE(userId);

    const user = await CacheService.getOrSet(
      cacheKey,
      CacheService.TTL.USER_PROFILE,
      () => UserModel.findById(userId)
    );

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    return user;
  },
};

module.exports = AuthService;
