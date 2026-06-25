/**
 * ═══════════════════════════════════════════════════════════════
 *  Cache Service — Redis Cache-Aside Pattern
 * ═══════════════════════════════════════════════════════════════
 *
 * Implements the CACHE-ASIDE (Lazy Loading) pattern:
 *
 *   READ:
 *     1. Check Redis for cached data
 *     2. HIT  → return cached data, skip database
 *     3. MISS → query database → write result to Redis with TTL
 *
 *   WRITE:
 *     1. Perform the database write (INSERT/UPDATE/DELETE)
 *     2. INVALIDATE related cache keys (delete them from Redis)
 *     3. Next read will cache the fresh data (lazy population)
 *
 * WHY Cache-Aside over Write-Through?
 *   • Write-Through: writes to cache AND database on every mutation.
 *     Problem: caches data that may never be read (wasted memory).
 *   • Cache-Aside: only caches data that is actually read.
 *     More efficient for read-heavy workloads (which banking is).
 *
 * WHY Invalidate on Write instead of Updating the Cache?
 *   • Cache update on write requires computing the cache value
 *     at write time, which may involve complex JOINs.
 *   • Invalidation is simpler: delete the key, let the next
 *     reader populate it. Risk: one cache miss after each write.
 *   • This is acceptable because writes are rare compared to reads
 *     in a banking dashboard (read:write ratio ~100:1).
 *
 * TTL STRATEGY:
 *   • User profiles: 5 min (rarely changes)
 *   • Account balances: 30 sec (changes on deposit/withdraw)
 *   • Dashboard stats: 2 min (aggregated, expensive to compute)
 *   • Transaction history: 1 min (new transactions are appended)
 *
 * GRACEFUL DEGRADATION:
 *   If Redis is down, every method falls back to the database.
 *   Redis errors are logged but NEVER thrown to the caller.
 *   The application works without Redis — just slower.
 * ═══════════════════════════════════════════════════════════════
 */
const redis = require('../config/redis');
const logger = require('../utils/logger');
const { CACHE_KEYS } = require('../utils/constants');

// ── TTL values in seconds ────────────────────────────────────
const TTL = {
  USER_PROFILE: 300,          // 5 minutes
  USER_ACCOUNTS: 60,          // 1 minute
  ACCOUNT_BALANCE: 30,        // 30 seconds (high-write path)
  ACCOUNT_TRANSACTIONS: 60,   // 1 minute
  DASHBOARD_STATS: 120,       // 2 minutes (expensive query)
  ANALYTICS: 180,             // 3 minutes
};

const CacheService = {
  // ══════════════════════════════════════════════════════════
  //  CORE METHODS
  // ══════════════════════════════════════════════════════════

  /**
   * Get a value from cache.
   * Returns null on miss OR Redis error (graceful degradation).
   *
   * @param {string} key - Redis key
   * @returns {any|null} Parsed JSON value or null
   */
  async get(key) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        logger.debug('Cache HIT', { key });
        return JSON.parse(cached);
      }
      logger.debug('Cache MISS', { key });
      return null;
    } catch (error) {
      logger.error('Cache get error (falling back to DB)', {
        key,
        error: error.message,
      });
      return null; // Graceful degradation
    }
  },

  /**
   * Set a value in cache with TTL.
   *
   * @param {string} key   - Redis key
   * @param {any}    value - Value to cache (will be JSON.stringify'd)
   * @param {number} ttl   - Time-to-live in seconds
   */
  async set(key, value, ttl) {
    try {
      // EX = expire in seconds
      await redis.set(key, JSON.stringify(value), 'EX', ttl);
      logger.debug('Cache SET', { key, ttl });
    } catch (error) {
      logger.error('Cache set error', { key, error: error.message });
      // Don't throw — cache write failure is non-critical
    }
  },

  /**
   * Delete one or more cache keys.
   * Used for invalidation after writes.
   *
   * @param {...string} keys - One or more Redis keys
   */
  async invalidate(...keys) {
    try {
      if (keys.length === 0) return;

      // Filter out undefined/null keys
      const validKeys = keys.filter(Boolean);
      if (validKeys.length === 0) return;

      const result = await redis.del(...validKeys);
      logger.debug('Cache INVALIDATED', {
        keys: validKeys,
        deletedCount: result,
      });
    } catch (error) {
      logger.error('Cache invalidation error', {
        keys,
        error: error.message,
      });
    }
  },

  /**
   * Delete all keys matching a pattern.
   * Used when you need to invalidate all pages of a paginated result.
   *
   * CAUTION: SCAN is used instead of KEYS to avoid blocking Redis.
   * KEYS * would block the single-threaded Redis server for seconds
   * on large datasets. SCAN iterates incrementally.
   *
   * @param {string} pattern - Glob pattern (e.g., "user:abc123:*")
   */
  async invalidatePattern(pattern) {
    try {
      let cursor = '0';
      let totalDeleted = 0;

      do {
        // SCAN: returns [newCursor, [key1, key2, ...]]
        // COUNT 100: hint to Redis to return ~100 keys per iteration
        const [newCursor, keys] = await redis.scan(
          cursor, 'MATCH', pattern, 'COUNT', 100
        );
        cursor = newCursor;

        if (keys.length > 0) {
          await redis.del(...keys);
          totalDeleted += keys.length;
        }
      } while (cursor !== '0');

      if (totalDeleted > 0) {
        logger.debug('Cache PATTERN INVALIDATED', {
          pattern,
          deletedCount: totalDeleted,
        });
      }
    } catch (error) {
      logger.error('Cache pattern invalidation error', {
        pattern,
        error: error.message,
      });
    }
  },

  /**
   * Get-or-Set: the cache-aside pattern in a single call.
   *
   * 1. Try Redis first
   * 2. On miss, call the fetcher function (database query)
   * 3. Cache the result with TTL
   * 4. Return the result
   *
   * This is the PRIMARY method used by services.
   *
   * @param {string}   key     - Redis key
   * @param {number}   ttl     - TTL in seconds
   * @param {Function} fetcher - Async function that returns fresh data
   * @returns {any} Cached or freshly-fetched data
   */
  async getOrSet(key, ttl, fetcher) {
    // 1. Try cache
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    // 2. Cache miss → fetch from database
    const freshData = await fetcher();

    // 3. Cache the result (fire-and-forget)
    if (freshData !== null && freshData !== undefined) {
      this.set(key, freshData, ttl).catch(() => {});
    }

    // 4. Return fresh data
    return freshData;
  },

  // ══════════════════════════════════════════════════════════
  //  DOMAIN-SPECIFIC INVALIDATION HELPERS
  // ══════════════════════════════════════════════════════════

  /**
   * Invalidate all cache related to a user.
   * Called on profile update, role change, or account status change.
   *
   * @param {string} userId - User UUID
   */
  async invalidateUser(userId) {
    await this.invalidate(
      CACHE_KEYS.USER_PROFILE(userId),
      CACHE_KEYS.USER_ACCOUNTS(userId),
      CACHE_KEYS.DASHBOARD_STATS(userId),
      CACHE_KEYS.ANALYTICS(userId)
    );
  },

  /**
   * Invalidate all cache related to a transaction.
   * Called after deposit, withdrawal, or transfer.
   *
   * @param {string} userId       - User who initiated
   * @param {string} accountId    - Affected account
   * @param {string} [otherUserId]   - Second user (for transfers)
   * @param {string} [otherAccountId] - Second account (for transfers)
   */
  async invalidateTransaction(userId, accountId, otherUserId, otherAccountId) {
    const keysToInvalidate = [
      // Sender's cache
      CACHE_KEYS.USER_ACCOUNTS(userId),
      CACHE_KEYS.ACCOUNT_BALANCE(accountId),
      CACHE_KEYS.DASHBOARD_STATS(userId),
      CACHE_KEYS.ANALYTICS(userId),
    ];

    // Receiver's cache (transfers only)
    if (otherUserId) {
      keysToInvalidate.push(
        CACHE_KEYS.USER_ACCOUNTS(otherUserId),
        CACHE_KEYS.DASHBOARD_STATS(otherUserId),
        CACHE_KEYS.ANALYTICS(otherUserId)
      );
    }
    if (otherAccountId) {
      keysToInvalidate.push(CACHE_KEYS.ACCOUNT_BALANCE(otherAccountId));
    }

    await this.invalidate(...keysToInvalidate);

    // Invalidate paginated transaction history (multiple pages)
    await this.invalidatePattern(`account:${accountId}:txns:*`);
    if (otherAccountId) {
      await this.invalidatePattern(`account:${otherAccountId}:txns:*`);
    }
  },
};

// Export TTL values so services can reference them
CacheService.TTL = TTL;

module.exports = CacheService;
