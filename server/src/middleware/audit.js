/**
 * Audit Logger Middleware
 * ──────────────────────
 * Creates audit log entries for significant actions.
 * Used as a service function called from controllers/services,
 * NOT as Express middleware (because it needs contextual data
 * like entity_type, entity_id that only the handler knows).
 *
 * WHY not a middleware?
 *   Middleware runs for every request, but we only want to
 *   audit specific actions (login, transfer, etc.), and each
 *   action needs different entity_type/entity_id values.
 *   A service function called explicitly is more precise.
 */
const pool = require('../config/database');
const logger = require('../utils/logger');

/**
 * Record an action in the audit_logs table.
 *
 * @param {object} params
 * @param {string|null} params.userId     - UUID of the actor (null for system)
 * @param {string}      params.action     - Action name (e.g., 'user.login')
 * @param {string}      params.entityType - Entity type (e.g., 'user', 'account')
 * @param {string}      params.entityId   - UUID of the affected entity
 * @param {object}      params.oldValues  - State before change (null for creates)
 * @param {object}      params.newValues  - State after change (null for deletes)
 * @param {string}      params.ipAddress  - Client IP address
 * @param {string}      params.userAgent  - Client User-Agent header
 */
const createAuditLog = async ({
  userId = null,
  action,
  entityType = null,
  entityId = null,
  oldValues = null,
  newValues = null,
  ipAddress = null,
  userAgent = null,
}) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs 
        (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        action,
        entityType,
        entityId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        userAgent,
      ]
    );
  } catch (error) {
    // Audit log failures should NOT crash the main request.
    // Log the error and continue — the primary operation succeeded.
    logger.error('Failed to create audit log', {
      error: error.message,
      action,
      entityType,
      entityId,
    });
  }
};

/**
 * Extract client IP from the request.
 * Handles proxied requests (X-Forwarded-For) and direct connections.
 *
 * NOTE: In production behind a reverse proxy (nginx, ALB),
 * set `app.set('trust proxy', 1)` so Express reads X-Forwarded-For.
 */
const getClientIp = (req) => {
  return req.ip || req.connection?.remoteAddress || '0.0.0.0';
};

module.exports = { createAuditLog, getClientIp };
