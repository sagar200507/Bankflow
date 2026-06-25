/**
 * ═══════════════════════════════════════════════════════════════
 *  Account Controller — HTTP Request Handlers
 * ═══════════════════════════════════════════════════════════════
 *
 * Thin controller — extracts request data, delegates to service,
 * sends response. No business logic here.
 * ═══════════════════════════════════════════════════════════════
 */
const AccountService = require('../services/account.service');
const { successResponse } = require('../utils/response');
const catchAsync = require('../utils/catchAsync');
const { createAuditLog, getClientIp } = require('../middleware/audit');

const AccountController = {
  /**
   * POST /api/v1/accounts
   * Create a new bank account.
   *
   * Body: { accountType, currency? }
   * Response: 201 { account }
   */
  create: catchAsync(async (req, res) => {
    const { accountType, currency } = req.body;

    const account = await AccountService.createAccount(
      req.user.id,
      accountType,
      currency
    );

    await createAuditLog({
      userId: req.user.id,
      action: 'account.create',
      entityType: 'account',
      entityId: account.id,
      newValues: {
        accountNumber: account.account_number,
        accountType: account.account_type,
        currency: account.currency,
      },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent'),
    });

    return successResponse(res, 201, 'Account created successfully', { account });
  }),

  /**
   * GET /api/v1/accounts
   * List all accounts for the authenticated user.
   *
   * Response: 200 { accounts: [...] }
   */
  list: catchAsync(async (req, res) => {
    const accounts = await AccountService.getUserAccounts(req.user.id);

    return successResponse(res, 200, 'Accounts retrieved', { accounts });
  }),

  /**
   * GET /api/v1/accounts/:id
   * Get a single account by ID.
   *
   * Response: 200 { account }
   */
  getById: catchAsync(async (req, res) => {
    const account = await AccountService.getAccountById(
      req.params.id,
      req.user.id
    );

    return successResponse(res, 200, 'Account retrieved', { account });
  }),

  /**
   * POST /api/v1/accounts/:id/deposit
   * Deposit funds into an account.
   *
   * Body: { amount, description? }
   * Response: 200 { account, transaction }
   */
  deposit: catchAsync(async (req, res) => {
    const { amount, description } = req.body;

    const result = await AccountService.deposit(
      req.params.id,
      req.user.id,
      amount,
      description,
      getClientIp(req)
    );

    await createAuditLog({
      userId: req.user.id,
      action: 'account.deposit',
      entityType: 'account',
      entityId: req.params.id,
      newValues: {
        amount,
        newBalance: result.account.balance,
        transactionId: result.transaction.id,
      },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent'),
    });

    return successResponse(res, 200, 'Deposit successful', result);
  }),

  /**
   * POST /api/v1/accounts/:id/withdraw
   * Withdraw funds from an account.
   *
   * Body: { amount, description? }
   * Response: 200 { account, transaction }
   */
  withdraw: catchAsync(async (req, res) => {
    const { amount, description } = req.body;

    const result = await AccountService.withdraw(
      req.params.id,
      req.user.id,
      amount,
      description,
      getClientIp(req)
    );

    await createAuditLog({
      userId: req.user.id,
      action: 'account.withdraw',
      entityType: 'account',
      entityId: req.params.id,
      newValues: {
        amount,
        newBalance: result.account.balance,
        transactionId: result.transaction.id,
      },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent'),
    });

    return successResponse(res, 200, 'Withdrawal successful', result);
  }),
};

module.exports = AccountController;
