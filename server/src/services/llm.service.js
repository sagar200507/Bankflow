/**
 * ═══════════════════════════════════════════════════════════════
 *  LLM Service
 * ═══════════════════════════════════════════════════════════════
 *
 * Integrates with Google Gemini API to generate natural language
 * explanations based on deterministic fraud context.
 * ═══════════════════════════════════════════════════════════════
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { FRAUD_EXPLANATION_SYSTEM_PROMPT, FRAUD_FOLLOWUP_SYSTEM_PROMPT } = require('../utils/prompts');
const logger = require('../utils/logger');

// We do not fail on startup if key is missing, only when the feature is used
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'MISSING_KEY');
const MODEL = 'gemini-2.5-flash';

const LLMService = {
  /**
   * Generate an initial explanation for a flagged transaction.
   * 
   * @param {object} context - Deterministic JSON context from retrieval layer
   * @returns {string} Markdown explanation
   */
  async generateExplanation(context) {
    const key = process.env.GEMINI_API_KEY || '';
    logger.info(`[DEBUG] GEMINI_API_KEY present: ${!!key}, first 6 chars: ${key.substring(0, 6)}`);

    if (!process.env.GEMINI_API_KEY) {
      logger.warn('GEMINI_API_KEY is missing. Using graceful fallback.');
      return this._buildFallbackExplanation(context);
    }

    try {
      const model = genAI.getGenerativeModel({ 
        model: MODEL, 
        systemInstruction: FRAUD_EXPLANATION_SYSTEM_PROMPT 
      });
      const prompt = `Explain why this transaction was flagged based ONLY on this context:\n\n${JSON.stringify(context, null, 2)}`;
      
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500,
        }
      });

      return result.response.text();
    } catch (error) {
      logger.error('LLM API Error during generateExplanation', { 
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        errorDetails: error.errorDetails || error
      });
      // Graceful degradation
      return this._buildFallbackExplanation(context);
    }
  },

  /**
   * Generate an answer to a follow-up question.
   * 
   * @param {object} context - Deterministic JSON context from retrieval layer
   * @param {Array} previousTurns - Array of { question, answer } objects
   * @param {string} newQuestion - The user's new question
   * @returns {string} Markdown answer
   */
  async generateFollowUp(context, previousTurns, newQuestion) {
    if (!process.env.GEMINI_API_KEY) {
      logger.warn('GEMINI_API_KEY is missing during follow-up. Using graceful fallback.');
      return this._buildFallbackFollowUp();
    }

    try {
      const model = genAI.getGenerativeModel({ 
        model: MODEL, 
        systemInstruction: FRAUD_FOLLOWUP_SYSTEM_PROMPT 
      });

      const contents = [
        {
          role: 'user',
          parts: [{ text: `Here is the transaction context:\n\n${JSON.stringify(context, null, 2)}` }]
        },
        {
          role: 'model',
          parts: [{ text: 'Understood. I will strictly use this context to answer follow-up questions.' }]
        }
      ];

      // Append historical turns
      for (const turn of previousTurns) {
        contents.push({ role: 'user', parts: [{ text: turn.question }] });
        contents.push({ role: 'model', parts: [{ text: turn.answer }] });
      }

      // Append new question
      contents.push({ role: 'user', parts: [{ text: newQuestion }] });

      const result = await model.generateContent({
        contents,
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 300,
        }
      });

      return result.response.text();
    } catch (error) {
      logger.error('LLM API Error during generateFollowUp', { 
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        errorDetails: error.errorDetails || error
      });
      return this._buildFallbackFollowUp();
    }
  },

  /**
   * Graceful fallback if the LLM is unreachable or unconfigured.
   * Constructs a hardcoded string based on the primary flag type.
   */
  _buildFallbackExplanation(context) {
    if (!context || !context.triggered_rules || context.triggered_rules.length === 0) {
      return "This transaction was flagged by our automated security systems for manual review.";
    }

    const rules = context.triggered_rules.map(r => r.rule_name).join(', ');
    return `⚠️ **Automated Security Flag**\n\nThis transaction was flagged by our deterministic security engine for manual review.\n\n**Triggered Rules:** ${rules}\n\n*(Note: Detailed AI explanations are currently unavailable. Please check the raw signals above or contact support.)*`;
  },

  /**
   * Graceful fallback for follow-up questions if the LLM is unreachable.
   */
  _buildFallbackFollowUp() {
    return `⚠️ **AI Assistant Offline**\n\nI'm currently unable to process follow-up questions due to a missing API key or network error.\n\n*(Note: Please check your configuration or try again later.)*`;
  }
};

module.exports = { LLMService, MODEL };
