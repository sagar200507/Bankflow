/**
 * ═══════════════════════════════════════════════════════════════
 *  BankFlow — Express Application
 * ═══════════════════════════════════════════════════════════════
 *
 * This file creates and configures the Express app but does NOT
 * start listening. The separation of app creation from server
 * startup is a best practice because:
 *
 *   1. Tests can import `app` without starting a real HTTP server
 *      (Supertest creates its own ephemeral server).
 *   2. The entry point (index.js) handles process-level concerns
 *      (graceful shutdown, uncaught exceptions) separately.
 *   3. In serverless deployments, the platform manages the server —
 *      you only export the app.
 *
 * Middleware execution order matters — it's a pipeline:
 *   Request → Helmet → CORS → Rate Limit → JSON Parser →
 *   Morgan Logger → Routes → 404 Handler → Error Handler → Response
 * ═══════════════════════════════════════════════════════════════
 */
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const logger = require('./utils/logger');
const ApiError = require('./utils/ApiError');
const { errorResponse } = require('./utils/response');

// ── Route imports ────────────────────────────────────────────
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const accountRoutes = require('./routes/account.routes');
const transactionRoutes = require('./routes/transaction.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const fraudRoutes = require('./routes/fraud.routes');

const app = express();

// ══════════════════════════════════════════════════════════════
//  SECURITY MIDDLEWARE
// ══════════════════════════════════════════════════════════════

/**
 * Helmet — Sets 15+ HTTP security headers in a single call:
 *   • Content-Security-Policy: prevents XSS by restricting script sources
 *   • X-Content-Type-Options: nosniff — prevents MIME type sniffing
 *   • X-Frame-Options: DENY — prevents clickjacking
 *   • Strict-Transport-Security: forces HTTPS
 *   • X-XSS-Protection: legacy XSS filter
 *
 * In development, we relax CSP to allow Vite's dev tools.
 */
app.use(helmet({
  contentSecurityPolicy: config.nodeEnv === 'production',
}));

/**
 * CORS — Cross-Origin Resource Sharing
 *
 * Without CORS, the browser blocks requests from localhost:5173
 * (Vite) to localhost:5000 (Express) because they're different
 * origins (different ports = different origins).
 *
 * We whitelist only our frontend's origin, not '*' (wildcard),
 * because wildcard CORS:
 *   • Disables credential support (cookies, auth headers)
 *   • Is a security risk (any site can call our API)
 */
app.use(cors({
  origin: config.corsOrigin,
  credentials: true, // Allow cookies & Authorization header
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // Preflight cache: 24 hours
}));

/**
 * Rate Limiter — Prevents brute-force and DDoS
 *
 * Default: 100 requests per 15 minutes per IP.
 * Uses in-memory store (fine for single-server).
 * In production with multiple servers, use redis-store:
 *   const RedisStore = require('rate-limit-redis');
 *   store: new RedisStore({ sendCommand: (...args) => redis.call(...args) })
 *
 * Rate limit headers are sent in the response:
 *   X-RateLimit-Limit: 100
 *   X-RateLimit-Remaining: 97
 *   X-RateLimit-Reset: 1624500000
 */
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,  // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,   // Disable `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
  // Skip rate limiting in test environment
  skip: () => config.nodeEnv === 'test',
});

app.use('/api/', limiter);

// ══════════════════════════════════════════════════════════════
//  PARSING MIDDLEWARE
// ══════════════════════════════════════════════════════════════

/**
 * JSON Body Parser
 *
 * limit: '10kb' — rejects payloads larger than 10KB.
 * This prevents attackers from sending a 1GB JSON body to
 * exhaust server memory (a common DoS vector).
 *
 * express.json() internally uses the `body-parser` library.
 */
app.use(express.json({ limit: '10kb' }));

/**
 * URL-Encoded Parser
 *
 * extended: true uses the `qs` library which supports nested objects.
 * extended: false uses `querystring` which only supports flat key-value.
 * We use true for flexibility but limit size to prevent abuse.
 */
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ══════════════════════════════════════════════════════════════
//  LOGGING MIDDLEWARE
// ══════════════════════════════════════════════════════════════

/**
 * Morgan HTTP Logger
 *
 * Streams to Winston so HTTP logs appear in the same format
 * and destination as application logs (instead of stdout).
 *
 * 'combined' format in production includes remote-addr, user-agent.
 * 'dev' format in development is colorized and concise.
 *
 * We skip logging in test mode to keep test output clean.
 */
if (config.nodeEnv !== 'test') {
  const morganFormat = config.nodeEnv === 'production' ? 'combined' : 'dev';
  app.use(morgan(morganFormat, {
    stream: {
      write: (message) => logger.http(message.trim()),
    },
  }));
}

// ══════════════════════════════════════════════════════════════
//  REQUEST ENRICHMENT
// ══════════════════════════════════════════════════════════════

/**
 * Attach request timestamp and request ID for tracing.
 * In production, you'd use a correlation ID from a load balancer
 * (X-Request-ID header) instead of generating one here.
 */
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// ══════════════════════════════════════════════════════════════
//  ROUTES
// ══════════════════════════════════════════════════════════════

/**
 * API Versioning — /api/v1/...
 *
 * Versioning via URL path is the simplest and most visible approach.
 * When v2 is needed, mount it at /api/v2/ while keeping v1 alive
 * for backward compatibility.
 *
 * Alternatives (not used here):
 *   • Header versioning: Accept: application/vnd.bankflow.v1+json
 *   • Query param: /api/accounts?version=1
 */
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/accounts', accountRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/fraud', fraudRoutes);

// ══════════════════════════════════════════════════════════════
//  ERROR HANDLING
// ══════════════════════════════════════════════════════════════

/**
 * 404 Handler — catches requests to undefined routes.
 *
 * This middleware runs AFTER all routes. If no route matched,
 * it creates an ApiError(404) and forwards it to the global
 * error handler below.
 */
app.all('*', (req, res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
});

/**
 * Global Error Handler
 *
 * Express recognizes this as an error handler because it has
 * 4 parameters (err, req, res, next). It MUST have all 4,
 * even if `next` is unused — removing it changes the signature
 * and Express won't route errors here.
 *
 * Strategy:
 *   • Operational errors (isOperational=true): send err.message
 *   • Programmer errors (isOperational=false): log stack, send generic 500
 *   • Specific PostgreSQL error codes are mapped to user-friendly messages
 */
app.use((err, req, res, next) => {
  // Default to 500 if no status code was set
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // ── Log the error ──────────────────────────────────────────
  if (err.statusCode >= 500) {
    logger.error('Server error', {
      statusCode: err.statusCode,
      message: err.message,
      stack: config.nodeEnv === 'development' ? err.stack : undefined,
      path: req.originalUrl,
      method: req.method,
    });
  } else {
    logger.warn('Client error', {
      statusCode: err.statusCode,
      message: err.message,
      path: req.originalUrl,
    });
  }

  // ── Handle specific PostgreSQL error codes ─────────────────
  // 23505 = unique_violation (duplicate email, account number, etc.)
  if (err.code === '23505') {
    return errorResponse(res, 409, 'A record with this value already exists');
  }
  // 23503 = foreign_key_violation
  if (err.code === '23503') {
    return errorResponse(res, 400, 'Referenced record does not exist');
  }
  // 23514 = check_violation (e.g., negative balance)
  if (err.code === '23514') {
    return errorResponse(res, 400, 'Constraint violation: invalid value');
  }

  // ── Send response ──────────────────────────────────────────
  if (config.nodeEnv === 'development') {
    // In dev, include stack trace for debugging
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      stack: err.stack,
      error: err,
    });
  }

  // In production, hide internal details for non-operational errors
  if (err.isOperational) {
    return errorResponse(res, err.statusCode, err.message);
  }

  // Programmer error — don't leak details
  return errorResponse(res, 500, 'Something went wrong');
});

module.exports = app;
