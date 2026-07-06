/**
 * PostgreSQL Connection Pool
 * ──────────────────────────
 * Uses the `pg` library's Pool class for connection pooling.
 *
 * WHY a pool?
 *   Creating a new TCP connection per query is expensive (~20-50ms).
 *   A pool maintains a set of idle connections and hands them out on demand,
 *   keeping latency under 1ms for connection acquisition.
 *
 * Pool sizing:
 *   poolMin (2)  — keeps 2 warm connections ready at all times.
 *   poolMax (10) — caps concurrent connections to prevent overwhelming PG.
 *   The PostgreSQL max_connections default is 100; we leave headroom for
 *   admin tools, migrations, and other services.
 */
const { Pool } = require('pg');
const config = require('./index');
const logger = require('../utils/logger');

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  min: config.db.poolMin,
  max: config.db.poolMax,

  // Neon PostgreSQL requires SSL in production
  ssl:
    config.nodeEnv === 'production'
      ? { rejectUnauthorized: false }
      : false,

  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Log pool errors globally — a pool-level error means a connection
// was lost unexpectedly (network blip, PG restart, etc.)
pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error', { error: err.message });
});

pool.on('connect', () => {
  logger.debug('New PostgreSQL client connected');
});

/**
 * Health check — used by the /health endpoint
 * Runs a trivial query to confirm PG is reachable.
 */
pool.healthCheck = async () => {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    return true;
  } finally {
    client.release();
  }
};

module.exports = pool;
