-- ═══════════════════════════════════════════════════════════════
--  007: Audit Logs Table
-- ═══════════════════════════════════════════════════════════════
--  Immutable audit trail for compliance and debugging.
--  Every significant action (login, transfer, account change)
--  creates a row here.
--
--  Design decisions:
--    • entity_type + entity_id: polymorphic reference — tracks
--      changes to any entity without needing per-table audit tables.
--    • old_values / new_values: JSONB snapshots of changed fields.
--      Storing full snapshots (vs diffs) makes reconstruction trivial.
--    • NO UPDATE/DELETE allowed — audit logs are append-only.
--      We enforce this with a trigger that raises an exception.
--
--  3NF:
--    • user_id FK to users — who performed the action.
--    • entity_type is a VARCHAR (not FK) because it references
--      multiple tables dynamically.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Actor ──────────────────────────────────────────────────
  -- NULL for system-generated actions (e.g., cron jobs, auto-freeze).
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,

  -- ── Action ─────────────────────────────────────────────────
  -- e.g., 'user.login', 'account.create', 'transfer.execute',
  --       'fraud.flag', 'loan.approve'
  action          VARCHAR(100) NOT NULL,

  -- ── Target Entity ──────────────────────────────────────────
  -- Polymorphic: entity_type = 'account', entity_id = <uuid>
  entity_type     VARCHAR(50),
  entity_id       UUID,

  -- ── Change Data ────────────────────────────────────────────
  -- old_values: state before the change (NULL for creates)
  -- new_values: state after the change (NULL for deletes)
  old_values      JSONB,
  new_values      JSONB,

  -- ── Request Context ────────────────────────────────────────
  ip_address      INET,
  user_agent      TEXT,

  -- ── Timestamp ──────────────────────────────────────────────
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────
-- "Show all actions by user X" (compliance review)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
  ON audit_logs(user_id);

-- "Show all changes to entity Y" (debugging)
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON audit_logs(entity_type, entity_id);

-- Time-range queries for audit reports
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON audit_logs USING BRIN(created_at);

-- Action filtering ("show all logins")
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON audit_logs(action);

-- ══════════════════════════════════════════════════════════════
--  IMMUTABILITY TRIGGER
-- ══════════════════════════════════════════════════════════════
-- Prevents any UPDATE or DELETE on audit_logs.
-- This is a hard requirement for financial compliance (SOX, PCI).
-- Even DBAs cannot modify records — they must be preserved forever.
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable — UPDATE and DELETE are prohibited';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS immutable_audit_logs ON audit_logs;
CREATE TRIGGER immutable_audit_logs
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();
