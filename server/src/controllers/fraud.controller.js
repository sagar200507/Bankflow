/**
 * ═══════════════════════════════════════════════════════════════
 *  Fraud Controller — HTTP Request Handlers
 * ═══════════════════════════════════════════════════════════════
 */
const FraudDetectionService = require('../services/fraud.service');
const { successResponse } = require('../utils/response');
const catchAsync = require('../utils/catchAsync');
const { createAuditLog, getClientIp } = require('../middleware/audit');
const { PAGINATION } = require('../utils/constants');

const FraudController = {
  /**
   * GET /api/v1/fraud/flags
   * Get fraud flags for the authenticated user.
   * Admins can see all unresolved flags across all users.
   *
   * Query: ?page=1&limit=20&resolved=false
   */
  getFlags: catchAsync(async (req, res) => {
    const page = parseInt(req.query.page, 10) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(
      parseInt(req.query.limit, 10) || PAGINATION.DEFAULT_LIMIT,
      PAGINATION.MAX_LIMIT
    );
    const resolved = req.query.resolved !== undefined
      ? req.query.resolved === 'true'
      : null;

    let result;

    if (req.user.role === 'admin' && req.query.all === 'true') {
      // Admin: view all unresolved flags
      result = await FraudDetectionService.getAllUnresolved({ page, limit });
    } else {
      // Regular user: view own flags
      result = await FraudDetectionService.getUserFlags(req.user.id, {
        page,
        limit,
        resolved,
      });
    }

    return successResponse(
      res,
      200,
      'Fraud flags retrieved',
      { flags: result.flags },
      {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      }
    );
  }),

  /**
   * GET /api/v1/fraud/flags/:id
   * Get a single fraud flag by ID.
   */
  getFlagById: catchAsync(async (req, res) => {
    const flag = await FraudDetectionService.getFlagById(req.params.id);

    // Users can only view their own flags
    if (req.user.role !== 'admin' && flag.user_id !== req.user.id) {
      const ApiError = require('../utils/ApiError');
      throw ApiError.forbidden('You can only view your own fraud flags');
    }

    return successResponse(res, 200, 'Fraud flag retrieved', { flag });
  }),

  /**
   * PATCH /api/v1/fraud/flags/:id/resolve
   * Resolve a fraud flag (admin/auditor only).
   *
   * Body: { note: "Verified as legitimate transaction" }
   */
  resolveFlag: catchAsync(async (req, res) => {
    const { note } = req.body;

    const flag = await FraudDetectionService.resolveFlag(
      req.params.id,
      req.user.id,
      note || 'Resolved without note'
    );

    await createAuditLog({
      userId: req.user.id,
      action: 'fraud.resolve',
      entityType: 'fraud_flag',
      entityId: req.params.id,
      newValues: {
        resolvedBy: req.user.id,
        resolutionNote: note,
        flagType: flag.flag_type,
        severity: flag.severity,
      },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent'),
    });

    return successResponse(res, 200, 'Fraud flag resolved', { flag });
  }),
};

module.exports = FraudController;
