/**
 * Redis Client Configuration
 * ──────────────────────────
 * Uses `ioredis` — a robust, cluster-aware Redis client for Node.js.
 *
 * Cache-aside pattern (implemented in services):
 *   1. Check Redis first.
 *   2. On MISS → query PostgreSQL → write result to Redis with TTL.
 *   3. On HIT  → return cached data, skip PG entirely.
 *
 * WHY ioredis over node-redis?
 *   • Built-in reconnect with exponential backoff
 *   • Cluster & Sentinel support out of the box
 *   • Lua scripting support for atomic operations
 *   • Better TypeScript types and community maintenance
 */
const Redis = require('ioredis');
const config = require('./index');
const logger = require('../utils/logger');

const redisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    // Exponential backoff: 50ms, 100ms, 200ms… capped at 2s
    const delay = Math.min(times * 50, 2000);
    logger.warn(`Redis reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },
  // Fail fast in dev so broken Redis doesn't silently degrade
  lazyConnect: config.nodeEnv === 'production',
};

const redis = new Redis(redisOptions);

redis.on('connect', () => {
  logger.info('✅ Redis connected');
});

redis.on('error', (err) => {
  logger.error('Redis connection error', { error: err.message });
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

/**
 * Health check — confirms Redis responds to PING.
 */
redis.healthCheck = async () => {
  const pong = await redis.ping();
  return pong === 'PONG';
};

module.exports = redis;
