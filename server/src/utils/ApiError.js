/**
 * Custom API Error Class
 * ──────────────────────
 * Extends the native Error to carry an HTTP status code and
 * an optional `isOperational` flag.
 *
 * WHY this pattern?
 *   Express error handlers receive (err, req, res, next).
 *   By attaching `statusCode` and `isOperational`, the global
 *   error handler can distinguish between:
 *     • Operational errors (bad input, 404) → send clear message to client
 *     • Programmer errors (null ref, type error) → log + generic 500
 *
 * This prevents leaking internal stack traces to API consumers.
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code (400, 401, 403, 404, 500…)
   * @param {string} message    - Human-readable error message
   * @param {boolean} isOperational - true = expected error, false = bug
   */
  constructor(statusCode, message, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

    // Capture stack trace, excluding the constructor call itself
    Error.captureStackTrace(this, this.constructor);
  }

  // ── Factory methods for common errors ──

  static badRequest(message = 'Bad request') {
    return new ApiError(400, message);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  static conflict(message = 'Conflict') {
    return new ApiError(409, message);
  }

  static tooMany(message = 'Too many requests') {
    return new ApiError(429, message);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, message, false);
  }
}

module.exports = ApiError;
