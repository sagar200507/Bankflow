/**
 * Health Routes
 * ─────────────
 * Provides health check endpoints for load balancers,
 * Kubernetes probes, and monitoring systems.
 *
 * /health       — shallow health check (is Express alive?)
 * /health/ready — deep readiness check (are PG + Redis connected?)
 *
 * WHY two endpoints?
 *   Kubernetes uses two probe types:
 *     • livenessProbe → /health (is the process alive? restart if not)
 *     • readinessProbe → /health/ready (can it serve traffic? remove from LB if not)
 *
 *   A server can be live but not ready (e.g., PG is down).
 *   Traffic should stop routing to it, but it shouldn't be killed.
 */
const express = require('express');
const pool = require('../config/database');
const redis = require('../config/redis');
const { successResponse, errorResponse } = require('../utils/response');
const catchAsync = require('../utils/catchAsync');

const router = express.Router();

/**
 * GET /api/v1/health
 * Shallow health check — confirms Express is running.
 * Returns 200 with uptime and memory usage.
 */
router.get('/', (req, res) => {
  return successResponse(res, 200, 'BankFlow API is healthy', {
    status: 'healthy',
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
    memory: {
      rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
    },
  });
});

/**
 * GET /api/v1/health/ready
 * Deep readiness check — verifies PostgreSQL and Redis connectivity.
 * Returns 200 if all dependencies are healthy, 503 if any are down.
 */
router.get('/ready', catchAsync(async (req, res) => {
  const checks = {
    postgresql: false,
    redis: false,
  };

  // ── Check PostgreSQL ─────────────────────────────────────────
  try {
    await pool.healthCheck();
    checks.postgresql = true;
  } catch (error) {
    checks.postgresql = false;
  }

  // ── Check Redis ──────────────────────────────────────────────
  try {
    await redis.healthCheck();
    checks.redis = true;
  } catch (error) {
    checks.redis = false;
  }

  const allHealthy = checks.postgresql && checks.redis;

  if (allHealthy) {
    return successResponse(res, 200, 'All services are ready', {
      status: 'ready',
      checks,
      timestamp: new Date().toISOString(),
    });
  }

  return errorResponse(res, 503, 'One or more services are unavailable', checks);
}));

module.exports = router;
