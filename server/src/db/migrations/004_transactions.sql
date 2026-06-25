-- ═══════════════════════════════════════════════════════════════
--  004: Transactions Table
-- ═══════════════════════════════════════════════════════════════
--  The heart of the banking system. Every money movement
--  (deposit, withdrawal, transfer) creates exactly one row here.
--
--  3NF compliance:
--    • from_account_id / to_account_id are FKs — no account data
--      duplicated. To display account info, JOIN to accounts.
--    • reference_number is a unique business identifier separate
--      from the UUID primary key.
--
--  Nullability rules:
--    • Deposits:    from_account_id IS NULL, to_account_id IS NOT NULL
--    • Withdrawals: from_account_id IS NOT NULL, to_account_id IS NULL
--    • Transfers:   Both are NOT NULL
--
--  The CHECK constraint enforces that at least one account is involved.
--
--  IMPORTANT — Transactions are append-only:
--    • No UPDATE on amount/type — once recorded, immutable.
--    • Reversals create a NEW transaction with type='transfer'
--      moving funds back.
--    • This is an audit requirement in real banking systems.
-- ═══════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal', 'transfer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'reversed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Linked Accounts ────────────────────────────────────────
  -- NULLABLE: deposits have no source, withdrawals have no dest.
  -- SET NULL on delete: if an account is deleted, historical
  -- transactions are preserved with NULL reference (audit trail).
  from_account_id   UUID REFERENCES accounts(id) ON DELETE SET NULL,
  to_account_id     UUID REFERENCES accounts(id) ON DELETE SET NULL,

  -- ── Transaction Details ────────────────────────────────────
  type              transaction_type NOT NULL,
  amount            NUMERIC(15, 2) NOT NULL,
  currency          VARCHAR(3) NOT NULL DEFAULT 'INR',
  status            transaction_status NOT NULL DEFAULT 'pending',
  description       TEXT,

  -- ── Reference ──────────────────────────────────────────────
  -- Format: "TXN-YYYYMMDD-XXXXXXXX" (app-generated)
  -- Used by customers and support to identify transactions.
  reference_number  VARCHAR(30) NOT NULL UNIQUE,

  -- ── Metadata ───────────────────────────────────────────────
  -- Stored for fraud detection (geographic inconsistency checks).
  ip_address        INET,

  -- Running balance AFTER this transaction — useful for
  -- generating account statements without recomputing.
  balance_after     NUMERIC(15, 2),

  -- ── Timestamp ──────────────────────────────────────────────
  -- No updated_at: transactions are immutable once created.
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ── Constraints ────────────────────────────────────────────
  CONSTRAINT chk_amount_positive CHECK (amount > 0),
  CONSTRAINT chk_at_least_one_account
    CHECK (from_account_id IS NOT NULL OR to_account_id IS NOT NULL),
  -- Prevent self-transfers
  CONSTRAINT chk_no_self_transfer
    CHECK (from_account_id IS DISTINCT FROM to_account_id)
);

-- ── Indexes ──────────────────────────────────────────────────
-- Account-based lookups (transaction history page)
CREATE INDEX IF NOT EXISTS idx_transactions_from_account
  ON transactions(from_account_id);

CREATE INDEX IF NOT EXISTS idx_transactions_to_account
  ON transactions(to_account_id);

-- Time-range queries (analytics, monthly reports)
-- BRIN index is ideal for append-only tables where created_at
-- is naturally correlated with physical row order.
-- BRIN uses ~1000× less space than B-tree for time columns.
CREATE INDEX IF NOT EXISTS idx_transactions_created_at
  ON transactions USING BRIN(created_at);

-- Status filtering (pending transactions dashboard)
CREATE INDEX IF NOT EXISTS idx_transactions_status
  ON transactions(status);
