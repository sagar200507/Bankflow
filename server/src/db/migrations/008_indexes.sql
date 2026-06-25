-- ═══════════════════════════════════════════════════════════════
--  008: Composite & Covering Indexes
-- ═══════════════════════════════════════════════════════════════
--  This migration adds composite indexes that span multiple
--  columns, designed for specific query patterns in the app.
--
--  Index design philosophy:
--    • Single-column indexes were created in each table's migration.
--    • This file adds COMPOSITE indexes for multi-column WHERE/JOIN.
--    • Covering indexes (INCLUDE) add columns to the index leaf
--      nodes so PostgreSQL can answer queries without hitting the
--      heap (index-only scans).
--
--  EXPLAIN ANALYZE is used in Phase 9 to validate these choices.
-- ═══════════════════════════════════════════════════════════════

-- ── Transactions: account + time range ───────────────────────
-- Query: "Show me account X's transactions from Jan to Mar"
-- This composite index lets PG seek to the account, then scan
-- the time range within that account's partition of the index.
CREATE INDEX IF NOT EXISTS idx_transactions_account_time
  ON transactions(from_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_to_account_time
  ON transactions(to_account_id, created_at DESC);

-- ── Transactions: covering index for history listing ─────────
-- INCLUDE columns are stored in the index but NOT used for
-- lookups — they enable index-only scans for the most common
-- transaction history query (avoids heap access entirely).
CREATE INDEX IF NOT EXISTS idx_transactions_history_covering
  ON transactions(from_account_id, created_at DESC)
  INCLUDE (type, amount, status, reference_number);

-- ── Accounts: user's active accounts ─────────────────────────
-- Query: "Fetch user X's active accounts with balances"
-- Partial index: only indexes active accounts (85%+ of rows),
-- making the index smaller and faster.
CREATE INDEX IF NOT EXISTS idx_accounts_user_active
  ON accounts(user_id)
  WHERE status = 'active';

-- ── Fraud flags: unresolved by severity (dashboard) ──────────
-- Query: "Show critical unresolved fraud flags"
-- Composite with partial: only indexes unresolved flags.
CREATE INDEX IF NOT EXISTS idx_fraud_unresolved_severity
  ON fraud_flags(severity DESC, created_at DESC)
  WHERE is_resolved = FALSE;

-- ── Loans: user's active loans ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_loans_user_active
  ON loans(user_id, status)
  WHERE status IN ('pending', 'active');
