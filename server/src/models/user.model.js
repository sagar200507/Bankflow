/**
 * ═══════════════════════════════════════════════════════════════
 *  User Model — Data Access Layer
 * ═══════════════════════════════════════════════════════════════
 *
 * Contains ALL SQL queries related to the `users` table.
 * No business logic — that belongs in the service layer.
 *
 * SECURITY:
 *   • Every query uses parameterized placeholders ($1, $2, ...).
 *     This makes SQL injection IMPOSSIBLE because the database
 *     driver sends parameters separately from the query string.
 *     The DB engine never interprets parameters as SQL.
 *
 *   • password_hash is EXCLUDED from SELECT by default.
 *     The `findByEmail` method explicitly includes it because
 *     the auth service needs it for bcrypt comparison.
 *     All other queries use `findById` which omits it.
 *
 * NAMING CONVENTION:
 *   • findByX  → SELECT (returns null if not found)
 *   • create   → INSERT (returns the created row)
 *   • updateX  → UPDATE (returns the updated row)
 * ═══════════════════════════════════════════════════════════════
 */
const pool = require('../config/database');

const UserModel = {
  /**
   * Find a user by ID — for profile display and authorization.
   * EXCLUDES password_hash for security.
   *
   * @param {string} id - UUID
   * @returns {object|null} User row or null
   */
  async findById(id) {
    const { rows } = await pool.query(
      `SELECT id, email, first_name, last_name, phone, role,
              is_verified, is_active, last_login_at, last_login_ip,
              created_at, updated_at
       FROM users
       WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Find a user by email — for login authentication.
   * INCLUDES password_hash because bcrypt.compare() needs it.
   *
   * Uses LOWER() to match the case-insensitive unique index.
   *
   * @param {string} email
   * @returns {object|null} User row (with password_hash) or null
   */
  async findByEmail(email) {
    const { rows } = await pool.query(
      `SELECT id, email, password_hash, first_name, last_name,
              phone, role, is_verified, is_active,
              last_login_at, last_login_ip,
              created_at, updated_at
       FROM users
       WHERE LOWER(email) = LOWER($1)`,
      [email]
    );
    return rows[0] || null;
  },

  /**
   * Create a new user — for registration.
   *
   * RETURNING clause avoids a second SELECT query.
   * password_hash is excluded from the return value.
   *
   * @param {object} userData
   * @returns {object} Created user row (without password_hash)
   */
  async create({ email, passwordHash, firstName, lastName, phone }) {
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, first_name, last_name, phone, role,
                 is_verified, is_active, created_at, updated_at`,
      [email, passwordHash, firstName, lastName, phone || null]
    );
    return rows[0];
  },

  /**
   * Update last login timestamp and IP.
   * Called on every successful login for security auditing.
   *
   * The INET type in PostgreSQL validates the IP format —
   * invalid IPs will throw a database error.
   *
   * @param {string} id - User UUID
   * @param {string} ip - Client IP address
   */
  async updateLastLogin(id, ip) {
    await pool.query(
      `UPDATE users
       SET last_login_at = NOW(), last_login_ip = $2
       WHERE id = $1`,
      [id, ip]
    );
  },

  /**
   * Update user profile fields.
   * Only updates the fields that are provided (partial update).
   *
   * @param {string} id - User UUID
   * @param {object} updates - { firstName, lastName, phone }
   * @returns {object} Updated user row
   */
  async updateProfile(id, { firstName, lastName, phone }) {
    const { rows } = await pool.query(
      `UPDATE users
       SET first_name = COALESCE($2, first_name),
           last_name = COALESCE($3, last_name),
           phone = COALESCE($4, phone)
       WHERE id = $1
       RETURNING id, email, first_name, last_name, phone, role,
                 is_verified, is_active, created_at, updated_at`,
      [id, firstName, lastName, phone]
    );
    return rows[0] || null;
  },

  /**
   * Update password — for password change/reset.
   * Accepts the NEW bcrypt hash (hashing is done in the service layer).
   *
   * @param {string} id - User UUID
   * @param {string} newPasswordHash - Bcrypt hash of new password
   */
  async updatePassword(id, newPasswordHash) {
    await pool.query(
      `UPDATE users SET password_hash = $2 WHERE id = $1`,
      [id, newPasswordHash]
    );
  },

  /**
   * Check if an email is already registered.
   * Used during registration to give a clear error message
   * before hitting the unique constraint.
   *
   * @param {string} email
   * @returns {boolean}
   */
  async emailExists(email) {
    const { rows } = await pool.query(
      `SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email]
    );
    return rows.length > 0;
  },

  /**
   * Get total user count — for admin dashboard.
   *
   * @returns {number}
   */
  async count() {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM users`
    );
    return rows[0].total;
  },
};

module.exports = UserModel;
