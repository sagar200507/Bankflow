-- ═══════════════════════════════════════════════════════════════
--  006: Fraud Flags Table
-- ═══════════════════════════════════════════════════════════════
--  Records suspicious activity detected by the fraud engine.
--  Each flag is tied to a specific transaction and user.
--
--  3NF compliance:
--    • transaction_id and user_id are FKs — no duplication.
--    • resolved_by is a FK to the admin who reviewed the flag.
--    • flag_type describes the detection method, not the result.
--
--  Fraud detection methods (implemented in Phase 7):
--    • velocity_check:        Too many transactions in a short window
--    • anomaly_detection:     Amount exceeds N × user's average
--    • geo_inconsistency:     IP location doesn't match user's pattern
--    • large_transaction:     Single transaction above threshold
--    • unusual_hours:         Transaction at unusual time for user
-- ═══════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE fraud_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE fraud_flag_type AS ENUM (
    'velocity_check',
    'anomaly_detection',
    'geo_inconsistency',
    'large_transaction',
    'unusual_hours'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS fraud_flags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── References ─────────────────────────────────────────────
  transaction_id  UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- ── Flag Details ───────────────────────────────────────────
  flag_type       fraud_flag_type NOT NULL,
  severity        fraud_severity NOT NULL DEFAULT 'medium',
  description     TEXT NOT NULL,

  -- ── Metadata ───────────────────────────────────────────────
  -- JSONB stores structured evidence (e.g., the IP addresses,
  -- the average amount, the velocity count). JSONB supports
  -- indexing and querying with operators like @>, ?, etc.
  metadata        JSONB DEFAULT '{}',

  -- ── Resolution ─────────────────────────────────────────────
  is_resolved     BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at     TIMESTAMPTZ,
  resolution_note TEXT,

  -- ── Timestamp ──────────────────────────────────────────────
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────
-- Dashboard: "show me all unresolved fraud flags"
CREATE INDEX IF NOT EXISTS idx_fraud_flags_unresolved
  ON fraud_flags(is_resolved) WHERE is_resolved = FALSE;

CREATE INDEX IF NOT EXISTS idx_fraud_flags_user_id
  ON fraud_flags(user_id);

CREATE INDEX IF NOT EXISTS idx_fraud_flags_severity
  ON fraud_flags(severity);

-- GIN index on JSONB metadata for operator-based queries
CREATE INDEX IF NOT EXISTS idx_fraud_flags_metadata
  ON fraud_flags USING GIN(metadata);
