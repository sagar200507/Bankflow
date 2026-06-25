/**
 * ═══════════════════════════════════════════════════════════════
 *  JWT Token Utility
 * ═══════════════════════════════════════════════════════════════
 *
 * Handles JWT generation and verification for both access and
 * refresh tokens.
 *
 * Token Strategy (Access + Refresh):
 * ───────────────────────────────────
 *   Access Token:  Short-lived (15 min), sent in Authorization header.
 *   Refresh Token: Long-lived (7 days), sent in httpOnly cookie or body.
 *
 * WHY two tokens?
 *   • Access tokens are stateless — no DB lookup on every request.
 *     If compromised, they expire quickly (15 min).
 *   • Refresh tokens allow silent re-authentication without
 *     re-entering credentials. They can be revoked server-side
 *     (by checking a blacklist or version number in DB).
 *
 * Token Payload:
 *   { id: UUID, email: string, role: 'admin'|'user'|'auditor' }
 *
 * SECURITY:
 *   • Secrets are loaded from environment variables (never hardcoded).
 *   • Access and refresh tokens use DIFFERENT secrets — compromising
 *     one doesn't compromise the other.
 *   • Tokens include `iat` (issued at) and `exp` (expiry) claims
 *     automatically via jsonwebtoken.
 * ═══════════════════════════════════════════════════════════════
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const ApiError = require('./ApiError');

/**
 * Generate an access token.
 * Short TTL (15 min) — used for API authorization.
 *
 * @param {object} payload - { id, email, role }
 * @returns {string} Signed JWT string
 */
const generateAccessToken = (payload) => {
  return jwt.sign(
    {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    },
    config.jwt.accessSecret,
    {
      expiresIn: config.jwt.accessExpiry,
      issuer: 'bankflow-api',
      audience: 'bankflow-client',
    }
  );
};

/**
 * Generate a refresh token.
 * Long TTL (7 days) — used to get new access tokens.
 *
 * The refresh token only contains the user ID — minimal data
 * because it's stored longer and we want to minimize exposure.
 *
 * @param {object} payload - { id }
 * @returns {string} Signed JWT string
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(
    {
      id: payload.id,
      type: 'refresh', // Distinguishes from access tokens
    },
    config.jwt.refreshSecret,
    {
      expiresIn: config.jwt.refreshExpiry,
      issuer: 'bankflow-api',
    }
  );
};

/**
 * Verify and decode an access token.
 *
 * jwt.verify() does THREE things:
 *   1. Checks the signature (was this token signed with our secret?)
 *   2. Checks expiration (is `exp` in the future?)
 *   3. Decodes the payload
 *
 * If any check fails, it throws:
 *   • TokenExpiredError — token's `exp` is in the past
 *   • JsonWebTokenError — invalid signature, malformed token
 *   • NotBeforeError — token's `nbf` is in the future
 *
 * @param {string} token - JWT string from Authorization header
 * @returns {object} Decoded payload { id, email, role, iat, exp }
 */
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.accessSecret, {
      issuer: 'bankflow-api',
      audience: 'bankflow-client',
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Access token has expired');
    }
    throw ApiError.unauthorized('Invalid access token');
  }
};

/**
 * Verify and decode a refresh token.
 *
 * @param {string} token - JWT refresh token string
 * @returns {object} Decoded payload { id, type, iat, exp }
 */
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, config.jwt.refreshSecret, {
      issuer: 'bankflow-api',
    });

    // Extra check: ensure this is actually a refresh token
    if (decoded.type !== 'refresh') {
      throw ApiError.unauthorized('Invalid token type');
    }

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Refresh token has expired — please log in again');
    }
    if (error instanceof ApiError) throw error;
    throw ApiError.unauthorized('Invalid refresh token');
  }
};

/**
 * Generate both tokens as a pair.
 * Convenience function used during login and token refresh.
 *
 * @param {object} user - { id, email, role }
 * @returns {{ accessToken: string, refreshToken: string }}
 */
const generateTokenPair = (user) => {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user),
  };
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokenPair,
};
