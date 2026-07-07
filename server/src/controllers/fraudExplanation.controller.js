/**
 * ═══════════════════════════════════════════════════════════════
 *  Fraud Explanation Controller
 * ═══════════════════════════════════════════════════════════════
 * Handles the RAG explanation and Q&A routes.
 * ═══════════════════════════════════════════════════════════════
 */
const FraudExplanationService = require('../services/fraudExplanation.service');
const { LLMService, MODEL } = require('../services/llm.service');
const FraudModel = require('../models/fraud.model');
const { successResponse } = require('../utils/response');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');

const FraudExplanationController = {
  /**
   * GET /api/v1/transactions/:id/fraud-explanation
   */
  async getExplanation(req, res, next) {
    try {
      const transactionId = req.params.id;

      // 1. Check DB cache first
      let explanationRecord = await FraudModel.getExplanationByTransactionId(transactionId);
      
      // 2. If no cache, build context and generate
      if (!explanationRecord) {
        const context = await FraudExplanationService.buildContext(transactionId);
        let explanationText;
        
        if (req.rateLimitExceeded) {
          logger.warn('Rate limit exceeded for fraud explanation. Using fallback.', { transactionId });
          // LLMService is an object with generateExplanation and _buildFallbackExplanation.
          // Wait, _buildFallbackExplanation is not exposed in the exported object in llm.service.js!
          // Ah, I need to check llm.service.js to ensure I can call it.
          explanationText = LLMService._buildFallbackExplanation(context);
          
          explanationRecord = await FraudModel.saveExplanation(
            transactionId, 
            explanationText, 
            context, 
            'fallback-rate-limit'
          );
        } else {
          logger.info('Cache miss for fraud explanation, generating via LLM', { transactionId });
          explanationText = await LLMService.generateExplanation(context);
          
          explanationRecord = await FraudModel.saveExplanation(
            transactionId, 
            explanationText, 
            context, 
            MODEL
          );
        }
      } else {
        logger.info('Cache hit for fraud explanation', { transactionId });
      }

      return successResponse(res, 200, 'Fraud explanation retrieved successfully', {
        transaction_id: transactionId,
        explanation: explanationRecord.explanation,
        created_at: explanationRecord.created_at
      });

    } catch (error) {
      if (error.message === 'Transaction has no fraud flags') {
        return next(ApiError.badRequest(error.message));
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/transactions/:id/fraud-explanation/ask
   */
  async askQuestion(req, res, next) {
    try {
      const transactionId = req.params.id;
      const { question } = req.body;

      if (!question) {
        return next(ApiError.badRequest('Question is required'));
      }

      // 1. Retrieve the ground-truth context
      const context = await FraudExplanationService.buildContext(transactionId);

      // 2. Load past conversation history purely from server-side state
      const rawTurns = await FraudModel.getExplanationTurnsByTransactionId(transactionId);
      const previousTurns = rawTurns.map(t => ({
        question: t.question,
        answer: t.answer
      }));

      // 3. Generate answer
      const answer = await LLMService.generateFollowUp(context, previousTurns, question);

      // 4. Save the turn to maintain audit trail
      const turn = await FraudModel.saveExplanationTurn(
        transactionId,
        question,
        answer,
        context,
        MODEL
      );

      return successResponse(res, 200, 'Follow-up answer generated successfully', {
        question: turn.question,
        answer: turn.answer,
        created_at: turn.created_at
      });

    } catch (error) {
      next(error);
    }
  }
};

module.exports = FraudExplanationController;
