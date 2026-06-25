/**
 * ═══════════════════════════════════════════════════════════════
 *  Transaction Controller — HTTP Request Handlers
 * ═══════════════════════════════════════════════════════════════
 */
const TransactionService = require('../services/transaction.service');
const { successResponse } = require('../utils/response');
const catchAsync = require('../utils/catchAsync');
const { createAuditLog, getClientIp } = require('../middleware/audit');
const { PAGINATION } = require('../utils/constants');

const TransactionController = {
  /**
   * POST /api/v1/transactions/transfer
   * Transfer funds between two accounts.
   *
   * Body: { fromAccountId, toAccountId, amount, description? }
   * Response: 200 { transaction, fromAccount, toAccount }
   */
  transfer: catchAsync(async (req, res) => {
    const { fromAccountId, toAccountId, amount, description } = req.body;

    const result = await TransactionService.transfer({
      fromAccountId,
      toAccountId,
      amount,
      description,
      userId: req.user.id,
      ipAddress: getClientIp(req),
    });

    await createAuditLog({
      userId: req.user.id,
      action: 'transfer.execute',
      entityType: 'transaction',
      entityId: result.transaction.id,
      newValues: {
        fromAccountId,
        toAccountId,
        amount,
        referenceNumber: result.transaction.reference_number,
      },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent'),
    });

    return successResponse(res, 200, 'Transfer successful', result);
  }),

  /**
   * GET /api/v1/transactions
   * Get all transactions for the authenticated user.
   *
   * Query: ?page=1&limit=20
   * Response: 200 { transactions: [...], meta: { total, page, limit } }
   */
  getUserTransactions: catchAsync(async (req, res) => {
    const page = parseInt(req.query.page, 10) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(
      parseInt(req.query.limit, 10) || PAGINATION.DEFAULT_LIMIT,
      PAGINATION.MAX_LIMIT
    );

    const result = await TransactionService.getUserTransactions(
      req.user.id,
      { page, limit }
    );

    return successResponse(
      res,
      200,
      'Transactions retrieved',
      { transactions: result.transactions },
      {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      }
    );
  }),

  /**
   * GET /api/v1/transactions/account/:id
   * Get transactions for a specific account.
   *
   * Query: ?page=1&limit=20
   * Response: 200 { transactions: [...], meta }
   */
  getAccountTransactions: catchAsync(async (req, res) => {
    const page = parseInt(req.query.page, 10) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(
      parseInt(req.query.limit, 10) || PAGINATION.DEFAULT_LIMIT,
      PAGINATION.MAX_LIMIT
    );

    const result = await TransactionService.getAccountTransactions(
      req.params.id,
      req.user.id,
      { page, limit }
    );

    return successResponse(
      res,
      200,
      'Account transactions retrieved',
      { transactions: result.transactions },
      {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      }
    );
  }),

  /**
   * GET /api/v1/transactions/:id
   * Get a single transaction by ID.
   *
   * Response: 200 { transaction }
   */
  getById: catchAsync(async (req, res) => {
    const transaction = await TransactionService.getTransactionById(
      req.params.id,
      req.user.id
    );

    return successResponse(res, 200, 'Transaction retrieved', { transaction });
  }),
};

module.exports = TransactionController;
