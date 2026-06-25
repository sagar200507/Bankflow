-- ═══════════════════════════════════════════════════════════════
--  005: Loans Table
-- ═══════════════════════════════════════════════════════════════
--  Tracks loan applications and their lifecycle.
--
--  3NF compliance:
--    • user_id and account_id are FKs — no duplication.
--    • approved_by is a self-referencing FK to users (admin who approved).
--    • monthly_payment is a derived value, but we store it because
--      recalculating from principal + rate + term on every query
--      is wasteful and the formula is non-trivial (PMT formula).
--      This is an accepted 3NF denormalization with justification.
--
--  Interest calculation:
--    • interest_rate is stored as a percentage (e.g., 8.50 = 8.5%)
--    • monthly_payment uses the PMT formula, calculated at approval time
-- ═══════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE loan_status AS ENUM (
    'pending', 'approved', 'rejected', 'active', 'paid_off', 'defaulted'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS loans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Borrower ───────────────────────────────────────────────
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- ── Loan Terms ─────────────────────────────────────────────
  amount          NUMERIC(15, 2) NOT NULL,
  interest_rate   NUMERIC(5, 2) NOT NULL,   -- e.g., 8.50 means 8.5%
  term_months     INTEGER NOT NULL,
  monthly_payment NUMERIC(15, 2),            -- calculated at approval

  -- ── Status Lifecycle ───────────────────────────────────────
  -- pending → approved/rejected → active → paid_off/defaulted
  status          loan_status NOT NULL DEFAULT 'pending',

  -- ── Approval ───────────────────────────────────────────────
  -- NULL until an admin approves/rejects the loan.
  approved_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  rejection_reason TEXT,

  -- ── Timestamps ─────────────────────────────────────────────
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ── Constraints ────────────────────────────────────────────
  CONSTRAINT chk_loan_amount_positive CHECK (amount > 0),
  CONSTRAINT chk_interest_rate_range CHECK (interest_rate >= 0 AND interest_rate <= 100),
  CONSTRAINT chk_term_positive CHECK (term_months > 0)
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_loans_user_id
  ON loans(user_id);

CREATE INDEX IF NOT EXISTS idx_loans_status
  ON loans(status);

-- ── Auto-update trigger ──────────────────────────────────────
DROP TRIGGER IF EXISTS set_loans_updated_at ON loans;
CREATE TRIGGER set_loans_updated_at
  BEFORE UPDATE ON loans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
