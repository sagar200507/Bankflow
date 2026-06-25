/**
 * Constants
 * ────────
 * Application-wide constants. Centralizing these prevents magic numbers
 * and strings from scattering across the codebase.
 */

// ── User Roles (RBAC) ────────────────────────────────────
const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  AUDITOR: 'auditor',
};

// ── Account Types ─────────────────────────────────────────
const ACCOUNT_TYPES = {
  SAVINGS: 'savings',
  CHECKING: 'checking',
  BUSINESS: 'business',
};

// ── Account Status ────────────────────────────────────────
const ACCOUNT_STATUS = {
  ACTIVE: 'active',
  FROZEN: 'frozen',
  CLOSED: 'closed',
};

// ── Transaction Types ─────────────────────────────────────
const TRANSACTION_TYPES = {
  DEPOSIT: 'deposit',
  WITHDRAWAL: 'withdrawal',
  TRANSFER: 'transfer',
};

// ── Transaction Status ────────────────────────────────────
const TRANSACTION_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REVERSED: 'reversed',
};

// ── Loan Status ───────────────────────────────────────────
const LOAN_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ACTIVE: 'active',
  PAID_OFF: 'paid_off',
  DEFAULTED: 'defaulted',
};

// ── Fraud Flag Severity ───────────────────────────────────
const FRAUD_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

// ── Fraud Detection Thresholds ────────────────────────────
const FRAUD_THRESHOLDS = {
  // Velocity: max transactions within time window
  MAX_TRANSACTIONS_PER_MINUTE: 5,
  MAX_TRANSACTIONS_PER_HOUR: 30,
  // Anomaly: transaction amount exceeding N × average
  ANOMALY_MULTIPLIER: 3,
  // Large transaction threshold (flag for review)
  LARGE_TRANSACTION_AMOUNT: 50000,
};

// ── Redis Cache Keys ──────────────────────────────────────
const CACHE_KEYS = {
  USER_PROFILE: (id) => `user:${id}:profile`,
  USER_ACCOUNTS: (id) => `user:${id}:accounts`,
  ACCOUNT_BALANCE: (id) => `account:${id}:balance`,
  ACCOUNT_TRANSACTIONS: (id, page) => `account:${id}:txns:page:${page}`,
  DASHBOARD_STATS: (id) => `user:${id}:dashboard`,
  ANALYTICS: (id) => `user:${id}:analytics`,
};

// ── Pagination Defaults ───────────────────────────────────
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

module.exports = {
  ROLES,
  ACCOUNT_TYPES,
  ACCOUNT_STATUS,
  TRANSACTION_TYPES,
  TRANSACTION_STATUS,
  LOAN_STATUS,
  FRAUD_SEVERITY,
  FRAUD_THRESHOLDS,
  CACHE_KEYS,
  PAGINATION,
};
