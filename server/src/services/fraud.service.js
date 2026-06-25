/**
 * ═══════════════════════════════════════════════════════════════
 *  Fraud Detection Service — Business Logic Layer
 * ═══════════════════════════════════════════════════════════════
 *
 * The fraud detection engine runs three checks on every transaction:
 *
 *   1. VELOCITY CHECK
 *      "How many transactions has this user made in the last N minutes?"
 *      If count > threshold → flag as suspicious.
 *      Catches: Stolen credentials being used for rapid withdrawals.
 *
 *   2. ANOMALY DETECTION
 *      "Is this transaction amount abnormally large compared to history?"
 *      If amount > (average × multiplier) → flag as suspicious.
 *      Catches: Account takeover with a single large withdrawal.
 *
 *   3. GEOGRAPHIC INCONSISTENCY
 *      "Does the IP address match the user's typical location?"
 *      If IP subnet doesn't match recent history → flag as suspicious.
 *      Catches: Account access from a new country/region.
 *
 * IMPORTANT DESIGN DECISIONS:
 *
 *   • Fraud checks run AFTER the transaction completes.
 *     WHY? Blocking legitimate transactions with false positives
 *     destroys user trust. Instead, we flag and let humans review.
 *     High-severity flags can trigger account freezes.
 *
 *   • Each check runs independently.
 *     A transaction can trigger 0, 1, 2, or all 3 checks.
 *     Multiple flags indicate higher confidence of fraud.
 *
 *   • Fraud flags are NEVER deleted — they're resolved with notes.
 *     This creates an audit trail for compliance.
 *
 *   • The service is called fire-and-forget from the transaction
 *     service. Fraud check failures (e.g., DB timeout) do NOT
 *     cause the transaction to fail.
 * ═══════════════════════════════════════════════════════════════
 */
const FraudModel = require('../models/fraud.model');
const { FRAUD_THRESHOLDS, FRAUD_SEVERITY } = require('../utils/constants');
const logger = require('../utils/logger');

const FraudDetectionService = {
  /**
   * Run all fraud checks on a completed transaction.
   *
   * This is the main entry point — called by transaction services
   * after a successful deposit, withdrawal, or transfer.
   *
   * @param {object} params
   * @param {string} params.transactionId - UUID of the completed transaction
   * @param {string} params.userId        - UUID of the user who initiated it
   * @param {number} params.amount        - Transaction amount
   * @param {string} params.type          - 'deposit' | 'withdrawal' | 'transfer'
   * @param {string} params.ipAddress     - Client IP address
   * @returns {Array} Array of created fraud flags (may be empty)
   */
  async analyzeTransaction({ transactionId, userId, amount, type, ipAddress }) {
    const flags = [];

    try {
      // ── Run all checks in parallel for speed ─────────────
      const [velocityResult, anomalyResult, geoResult] = await Promise.all([
        this.checkVelocity(transactionId, userId),
        this.checkAnomaly(transactionId, userId, amount),
        ipAddress
          ? this.checkGeoConsistency(transactionId, userId, ipAddress)
          : Promise.resolve(null),
      ]);

      if (velocityResult) flags.push(velocityResult);
      if (anomalyResult) flags.push(anomalyResult);
      if (geoResult) flags.push(geoResult);

      // ── Large transaction check (simple threshold) ────────
      const largeResult = await this.checkLargeTransaction(
        transactionId, userId, amount
      );
      if (largeResult) flags.push(largeResult);

      if (flags.length > 0) {
        logger.warn('🚨 Fraud flags created', {
          transactionId,
          userId,
          flagCount: flags.length,
          types: flags.map((f) => f.flag_type),
        });
      }
    } catch (error) {
      // Fraud check failures should NEVER crash the transaction.
      // Log and continue — the transaction already succeeded.
      logger.error('Fraud detection error (non-blocking)', {
        error: error.message,
        transactionId,
        userId,
      });
    }

    return flags;
  },

  /**
   * VELOCITY CHECK
   *
   * Calls fn_velocity_check() to count recent transactions.
   * Thresholds (from constants.js):
   *   - MAX_TRANSACTIONS_PER_MINUTE: 5
   *   - MAX_TRANSACTIONS_PER_HOUR: 30
   *
   * @returns {object|null} Created flag or null
   */
  async checkVelocity(transactionId, userId) {
    // Check 5-minute window
    const shortWindow = await FraudModel.velocityCheck(userId, 5);
    const shortCount = parseInt(shortWindow.txn_count, 10);

    if (shortCount > FRAUD_THRESHOLDS.MAX_TRANSACTIONS_PER_MINUTE) {
      const severity = shortCount > FRAUD_THRESHOLDS.MAX_TRANSACTIONS_PER_MINUTE * 2
        ? FRAUD_SEVERITY.HIGH
        : FRAUD_SEVERITY.MEDIUM;

      return FraudModel.create({
        transactionId,
        userId,
        flagType: 'velocity_check',
        severity,
        description: `User made ${shortCount} transactions in 5 minutes (threshold: ${FRAUD_THRESHOLDS.MAX_TRANSACTIONS_PER_MINUTE})`,
        metadata: {
          count: shortCount,
          windowMinutes: 5,
          threshold: FRAUD_THRESHOLDS.MAX_TRANSACTIONS_PER_MINUTE,
          windowStart: shortWindow.window_start,
          windowEnd: shortWindow.window_end,
        },
      });
    }

    // Check 60-minute window
    const longWindow = await FraudModel.velocityCheck(userId, 60);
    const longCount = parseInt(longWindow.txn_count, 10);

    if (longCount > FRAUD_THRESHOLDS.MAX_TRANSACTIONS_PER_HOUR) {
      return FraudModel.create({
        transactionId,
        userId,
        flagType: 'velocity_check',
        severity: FRAUD_SEVERITY.LOW,
        description: `User made ${longCount} transactions in 60 minutes (threshold: ${FRAUD_THRESHOLDS.MAX_TRANSACTIONS_PER_HOUR})`,
        metadata: {
          count: longCount,
          windowMinutes: 60,
          threshold: FRAUD_THRESHOLDS.MAX_TRANSACTIONS_PER_HOUR,
        },
      });
    }

    return null;
  },

  /**
   * ANOMALY DETECTION
   *
   * Calls fn_anomaly_check() to compare the transaction amount
   * against the user's historical average.
   *
   * If amount > (avg × 3) → flag as anomaly.
   * If amount > (avg × 5) → flag as HIGH severity.
   *
   * @returns {object|null} Created flag or null
   */
  async checkAnomaly(transactionId, userId, amount) {
    const result = await FraudModel.anomalyCheck(
      userId,
      amount,
      FRAUD_THRESHOLDS.ANOMALY_MULTIPLIER
    );

    if (result.is_anomaly) {
      const ratio = parseFloat(result.avg_amount) > 0
        ? (amount / parseFloat(result.avg_amount)).toFixed(1)
        : 'N/A';

      const severity = amount > parseFloat(result.threshold) * 1.5
        ? FRAUD_SEVERITY.HIGH
        : FRAUD_SEVERITY.MEDIUM;

      return FraudModel.create({
        transactionId,
        userId,
        flagType: 'anomaly_detection',
        severity,
        description: `Transaction amount ₹${amount.toLocaleString()} is ${ratio}× the user's average of ₹${parseFloat(result.avg_amount).toLocaleString()}`,
        metadata: {
          amount,
          averageAmount: parseFloat(result.avg_amount),
          threshold: parseFloat(result.threshold),
          multiplier: FRAUD_THRESHOLDS.ANOMALY_MULTIPLIER,
          ratio: parseFloat(ratio),
          historyCount: parseInt(result.txn_history_count, 10),
        },
      });
    }

    return null;
  },

  /**
   * GEOGRAPHIC INCONSISTENCY CHECK
   *
   * Calls fn_geo_consistency_check() to compare the current IP
   * against the user's recent transaction IPs.
   *
   * If no matching /24 subnet → flag as suspicious.
   *
   * @returns {object|null} Created flag or null
   */
  async checkGeoConsistency(transactionId, userId, ipAddress) {
    // Skip for localhost/private IPs (development)
    if (
      ipAddress === '127.0.0.1' ||
      ipAddress === '::1' ||
      ipAddress?.startsWith('192.168.') ||
      ipAddress?.startsWith('10.')
    ) {
      return null;
    }

    const result = await FraudModel.geoCheck(userId, ipAddress);

    if (result.is_inconsistent) {
      return FraudModel.create({
        transactionId,
        userId,
        flagType: 'geo_inconsistency',
        severity: FRAUD_SEVERITY.HIGH,
        description: `Transaction from IP ${ipAddress} does not match user's recent locations`,
        metadata: {
          currentIp: ipAddress,
          recentIps: result.recent_ips,
          matchCount: parseInt(result.match_count, 10),
          totalRecent: parseInt(result.total_recent, 10),
        },
      });
    }

    return null;
  },

  /**
   * LARGE TRANSACTION CHECK
   *
   * Simple threshold check — flags transactions above a fixed amount.
   * This is the simplest fraud check but catches many real-world cases.
   *
   * @returns {object|null} Created flag or null
   */
  async checkLargeTransaction(transactionId, userId, amount) {
    if (amount >= FRAUD_THRESHOLDS.LARGE_TRANSACTION_AMOUNT) {
      const severity = amount >= FRAUD_THRESHOLDS.LARGE_TRANSACTION_AMOUNT * 2
        ? FRAUD_SEVERITY.HIGH
        : FRAUD_SEVERITY.MEDIUM;

      return FraudModel.create({
        transactionId,
        userId,
        flagType: 'large_transaction',
        severity,
        description: `Transaction amount ₹${amount.toLocaleString()} exceeds the ₹${FRAUD_THRESHOLDS.LARGE_TRANSACTION_AMOUNT.toLocaleString()} threshold`,
        metadata: {
          amount,
          threshold: FRAUD_THRESHOLDS.LARGE_TRANSACTION_AMOUNT,
        },
      });
    }

    return null;
  },

  // ══════════════════════════════════════════════════════════
  //  FLAG MANAGEMENT (for controllers)
  // ══════════════════════════════════════════════════════════

  /**
   * Get fraud flags for a user.
   */
  async getUserFlags(userId, options) {
    return FraudModel.findByUserId(userId, options);
  },

  /**
   * Get all unresolved flags (admin).
   */
  async getAllUnresolved(options) {
    return FraudModel.findAllUnresolved(options);
  },

  /**
   * Get a single fraud flag by ID.
   */
  async getFlagById(flagId) {
    const flag = await FraudModel.findById(flagId);
    if (!flag) {
      const ApiError = require('../utils/ApiError');
      throw ApiError.notFound('Fraud flag not found');
    }
    return flag;
  },

  /**
   * Resolve a fraud flag (admin action).
   */
  async resolveFlag(flagId, resolvedBy, note) {
    const flag = await FraudModel.resolve(flagId, resolvedBy, note);
    if (!flag) {
      const ApiError = require('../utils/ApiError');
      throw ApiError.notFound('Fraud flag not found');
    }

    logger.info('Fraud flag resolved', {
      flagId,
      resolvedBy,
      flagType: flag.flag_type,
    });

    return flag;
  },
};

module.exports = FraudDetectionService;
