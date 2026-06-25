/**
 * Standard API Response Helpers
 * ─────────────────────────────
 * Ensures every API response follows the same envelope:
 *   { success: true/false, data: {...}, message: '...', meta: {...} }
 *
 * WHY an envelope?
 *   • Clients can check `success` before parsing `data`
 *   • `meta` carries pagination, timestamps, etc.
 *   • Consistent structure makes frontend error handling trivial
 */

/**
 * Send a success response.
 * @param {object} res     - Express response object
 * @param {number} statusCode - HTTP status (200, 201, etc.)
 * @param {string} message - Human-readable success message
 * @param {object} data    - Response payload
 * @param {object} meta    - Optional metadata (pagination, etc.)
 */
const successResponse = (res, statusCode, message, data = null, meta = null) => {
  const response = {
    success: true,
    message,
  };
  if (data !== null) response.data = data;
  if (meta !== null) response.meta = meta;
  return res.status(statusCode).json(response);
};

/**
 * Send an error response.
 * @param {object} res     - Express response object
 * @param {number} statusCode - HTTP status (400, 500, etc.)
 * @param {string} message - Human-readable error message
 * @param {object} errors  - Optional validation errors array
 */
const errorResponse = (res, statusCode, message, errors = null) => {
  const response = {
    success: false,
    message,
  };
  if (errors !== null) response.errors = errors;
  return res.status(statusCode).json(response);
};

module.exports = { successResponse, errorResponse };
