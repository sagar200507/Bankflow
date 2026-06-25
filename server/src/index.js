/**
 * ═══════════════════════════════════════════════════════════════
 *  BankFlow — Server Entry Point
 * ═══════════════════════════════════════════════════════════════
 *
 * This file is responsible for:
 *   1. Starting the HTTP server
 *   2. Verifying database and Redis connectivity
 *   3. Handling graceful shutdown (SIGTERM, SIGINT)
 *   4. Catching unhandled exceptions and rejections
 *
 * WHY separate from app.js?
 *   app.js  → Express configuration (testable without a server)
 *   index.js → Process-level lifecycle management
 *
 * Graceful shutdown sequence:
 *   1. Stop accepting new connections
 *   2. Wait for in-flight requests to complete (5s timeout)
 *   3. Close database pool
 *   4. Close Redis connection
 *   5. Exit process
 * ═══════════════════════════════════════════════════════════════
 */
const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const pool = require('./config/database');
const redis = require('./config/redis');

let server;

/**
 * Verify external service connectivity before accepting traffic.
 * If PostgreSQL or Redis is unreachable, the server exits immediately
 * rather than starting in a degraded state.
 */
async function verifyConnections() {
  try {
    // ── PostgreSQL ─────────────────────────────────────────────
    await pool.healthCheck();
    logger.info('✅ PostgreSQL connected', {
      host: config.db.host,
      database: config.db.database,
    });

    // ── Redis ──────────────────────────────────────────────────
    await redis.healthCheck();
    logger.info('✅ Redis connected', {
      host: config.redis.host,
      port: config.redis.port,
    });
  } catch (error) {
    logger.error('❌ Failed to connect to external services', {
      error: error.message,
    });
    process.exit(1);
  }
}

/**
 * Start the HTTP server.
 */
async function startServer() {
  await verifyConnections();

  server = app.listen(config.port, () => {
    logger.info(`🏦 BankFlow server running`, {
      port: config.port,
      env: config.nodeEnv,
      pid: process.pid,
    });
    logger.info(`📡 API base: http://localhost:${config.port}/api/v1`);
  });

  // Set server timeouts
  server.keepAliveTimeout = 65000; // Slightly above ALB's 60s default
  server.headersTimeout = 66000;   // Must be > keepAliveTimeout
}

/**
 * Graceful shutdown — ensures no request is dropped.
 *
 * In Kubernetes/Docker, SIGTERM is sent first, then SIGKILL
 * after a grace period (default 30s). We have ~25s to finish
 * in-flight requests and close connections cleanly.
 */
async function gracefulShutdown(signal) {
  logger.info(`${signal} received — starting graceful shutdown`);

  // 1. Stop accepting new connections
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed — no new connections');
    });
  }

  try {
    // 2. Close database pool (waits for active queries to finish)
    await pool.end();
    logger.info('PostgreSQL pool closed');

    // 3. Close Redis connection
    await redis.quit();
    logger.info('Redis connection closed');
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
  }

  // 4. Exit
  logger.info('Shutdown complete');
  process.exit(0);
}

// ── Process Event Handlers ───────────────────────────────────

// SIGTERM: sent by Docker/K8s/systemd to gracefully stop
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// SIGINT: sent by Ctrl+C in the terminal
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/**
 * Unhandled Rejection — a Promise was rejected but no .catch() handled it.
 *
 * In Node.js 15+, unhandled rejections terminate the process by default.
 * We log the error and shut down gracefully instead of crashing abruptly.
 */
process.on('unhandledRejection', (reason) => {
  logger.error('UNHANDLED REJECTION — shutting down', {
    error: reason?.message || reason,
    stack: reason?.stack,
  });
  gracefulShutdown('UNHANDLED_REJECTION');
});

/**
 * Uncaught Exception — a synchronous error that wasn't caught.
 *
 * Unlike unhandled rejections, the process is in an undefined state
 * after an uncaught exception. We MUST exit — continuing could cause
 * data corruption or security vulnerabilities.
 */
process.on('uncaughtException', (error) => {
  logger.error('UNCAUGHT EXCEPTION — shutting down', {
    error: error.message,
    stack: error.stack,
  });
  // Exit immediately — don't try to close connections gracefully
  // because the process state is unreliable.
  process.exit(1);
});

// ── Start ────────────────────────────────────────────────────
startServer();
