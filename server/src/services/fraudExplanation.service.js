/**
 * ═══════════════════════════════════════════════════════════════
 *  Fraud Explanation Service (RAG Context Builder)
 * ═══════════════════════════════════════════════════════════════
 *
 * This service sits strictly downstream of the deterministic fraud 
 * engine. Its ONLY responsibility is gathering facts about a 
 * flagged transaction into a structured JSON payload for the LLM.
 *
 * PII Masking is strictly enforced here before the context
 * ever leaves our server.
 * ═══════════════════════════════════════════════════════════════
 */
const TransactionModel = require('../models/transaction.model');
const FraudModel = require('../models/fraud.model');
const logger = require('../utils/logger');

const FraudExplanationService = {
  /**
   * Build the deterministic ground-truth context for a flagged transaction.
   * 
   * @param {string} transactionId - UUID of the transaction
   * @returns {object} JSON context ready for the LLM
   */
  async buildContext(transactionId) {
    try {
      // 1. Fetch Transaction
      const transaction = await TransactionModel.findById(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // 2. Fetch Flags
      const flags = await FraudModel.getFlagsByTransactionId(transactionId);
      if (!flags || flags.length === 0) {
        throw new Error('Transaction has no fraud flags');
      }

      const userId = flags[0].user_id;

      // 3. Fetch Similar Past Cases for the primary flag
      const primaryFlagType = flags[0].flag_type;
      const similarFlagsRaw = await FraudModel.getSimilarPastFlags(userId, primaryFlagType, 5);
      
      // Filter out the current flags to only get historical ones
      const similarFlags = similarFlagsRaw
        .filter(f => new Date(f.created_at).getTime() !== new Date(flags[0].created_at).getTime())
        .slice(0, 3)
        .map(f => ({
          rule: f.flag_type,
          severity: f.severity,
          was_resolved: f.is_resolved,
          resolution_note: f.resolution_note || 'N/A'
        }));

      // 4. Fetch User Baseline (Activity Level)
      const totalTxns = await TransactionModel.countByUserId(userId);

      // 5. Assemble Context with PII Masking
      const context = {
        transaction: {
          id: transaction.id, // UUIDs are safe
          type: transaction.type,
          amount: transaction.amount,
          currency: transaction.currency,
          status: transaction.status,
          date: transaction.created_at,
          // PII Masking: Redact full account numbers, keep only last 4
          from_account: transaction.from_account_number 
            ? '****' + String(transaction.from_account_number).slice(-4) 
            : null,
          to_account: transaction.to_account_number 
            ? '****' + String(transaction.to_account_number).slice(-4) 
            : null,
          // Explicitly exclude IP address, name, email, etc.
        },
        triggered_rules: flags.map(f => ({
          rule_name: f.flag_type,
          severity: f.severity,
          description: f.description,
          computed_signals: f.metadata // The deterministic proof (thresholds, amounts)
        })),
        user_baseline: {
          total_historical_transactions: totalTxns,
        },
        similar_past_cases: similarFlags
      };

      return context;

    } catch (error) {
      logger.error('Failed to build fraud explanation context', {
        transactionId,
        error: error.message
      });
      throw error;
    }
  }
};

module.exports = FraudExplanationService;
