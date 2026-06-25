-- ═══════════════════════════════════════════════════════════════
--  BankFlow — Stored Procedure: Transfer Funds
-- ═══════════════════════════════════════════════════════════════
--
-- WHY a stored procedure instead of application-level SQL?
--
--   1. ATOMICITY GUARANTEE: The entire transfer (debit + credit +
--      ledger entry) executes as a single database operation.
--      Even if the Node.js process crashes mid-transfer, the DB
--      transaction rolls back automatically.
--
--   2. REDUCED ROUND TRIPS: Application-level transfers require
--      4-5 network round trips (BEGIN, SELECT, UPDATE×2, INSERT,
--      COMMIT). A stored procedure sends ONE call and receives
--      ONE result — ~3× faster on high-latency connections.
--
--   3. SECURITY: The procedure enforces business rules (balance
--      check, status validation) at the database level. Even if
--      a rogue API client bypasses application logic, the DB
--      rejects invalid operations.
--
--   4. ROW-LEVEL LOCKING: FOR UPDATE locks are held for the
--      shortest possible duration (within the procedure), 
--      reducing contention under high concurrency.
--
-- DEADLOCK PREVENTION:
--   Accounts are locked in ascending UUID order using:
--     IF p_from_id < p_to_id THEN lock from first
--     ELSE lock to first
--   This guarantees a consistent lock ordering across all
--   concurrent procedure calls.
--
-- RETURNS: JSON object with transaction details and updated balances.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_transfer_funds(
  p_from_id      UUID,
  p_to_id        UUID,
  p_amount       NUMERIC(15,2),
  p_description  TEXT DEFAULT 'Fund transfer',
  p_reference    VARCHAR(30) DEFAULT NULL,
  p_ip_address   INET DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_from_account   RECORD;
  v_to_account     RECORD;
  v_new_from_bal   NUMERIC(15,2);
  v_new_to_bal     NUMERIC(15,2);
  v_txn_id         UUID;
  v_reference      VARCHAR(30);
BEGIN
  -- ── Validate inputs ────────────────────────────────────────
  IF p_from_id = p_to_id THEN
    RAISE EXCEPTION 'Cannot transfer to the same account'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be positive'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Generate reference number if not provided ──────────────
  v_reference := COALESCE(p_reference,
    'TXN-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
    LPAD(FLOOR(RANDOM() * 100000000)::TEXT, 8, '0')
  );

  -- ══════════════════════════════════════════════════════════
  --  DEADLOCK-SAFE LOCKING
  --  Lock accounts in ascending UUID order to prevent deadlocks
  --  when two concurrent transfers involve the same accounts
  --  in reverse order (A→B vs B→A).
  -- ══════════════════════════════════════════════════════════
  IF p_from_id < p_to_id THEN
    -- Lock source first (lower UUID)
    SELECT * INTO v_from_account
    FROM accounts WHERE id = p_from_id FOR UPDATE;

    SELECT * INTO v_to_account
    FROM accounts WHERE id = p_to_id FOR UPDATE;
  ELSE
    -- Lock destination first (lower UUID)
    SELECT * INTO v_to_account
    FROM accounts WHERE id = p_to_id FOR UPDATE;

    SELECT * INTO v_from_account
    FROM accounts WHERE id = p_from_id FOR UPDATE;
  END IF;

  -- ── Validate accounts exist ────────────────────────────────
  IF v_from_account.id IS NULL THEN
    RAISE EXCEPTION 'Source account not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_to_account.id IS NULL THEN
    RAISE EXCEPTION 'Destination account not found'
      USING ERRCODE = 'P0002';
  END IF;

  -- ── Validate account statuses ──────────────────────────────
  IF v_from_account.status != 'active' THEN
    RAISE EXCEPTION 'Source account is %', v_from_account.status
      USING ERRCODE = 'P0003';
  END IF;

  IF v_to_account.status != 'active' THEN
    RAISE EXCEPTION 'Destination account is %', v_to_account.status
      USING ERRCODE = 'P0003';
  END IF;

  -- ── Validate currency match ────────────────────────────────
  IF v_from_account.currency != v_to_account.currency THEN
    RAISE EXCEPTION 'Currency mismatch: % to %',
      v_from_account.currency, v_to_account.currency
      USING ERRCODE = 'P0004';
  END IF;

  -- ── Check sufficient balance ───────────────────────────────
  IF v_from_account.balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient funds. Available: %, Requested: %',
      v_from_account.balance, p_amount
      USING ERRCODE = 'P0005';
  END IF;

  -- ══════════════════════════════════════════════════════════
  --  EXECUTE TRANSFER
  -- ══════════════════════════════════════════════════════════

  -- Calculate new balances
  v_new_from_bal := v_from_account.balance - p_amount;
  v_new_to_bal   := v_to_account.balance + p_amount;

  -- Debit sender
  UPDATE accounts
  SET balance = v_new_from_bal
  WHERE id = p_from_id;

  -- Credit receiver
  UPDATE accounts
  SET balance = v_new_to_bal
  WHERE id = p_to_id;

  -- Create transaction ledger entry
  INSERT INTO transactions (
    from_account_id, to_account_id, type, amount, currency,
    status, description, reference_number, ip_address, balance_after
  ) VALUES (
    p_from_id, p_to_id, 'transfer', p_amount,
    v_from_account.currency, 'completed', p_description,
    v_reference, p_ip_address, v_new_from_bal
  )
  RETURNING id INTO v_txn_id;

  -- ── Return result as JSONB ─────────────────────────────────
  RETURN jsonb_build_object(
    'transaction_id', v_txn_id,
    'reference_number', v_reference,
    'amount', p_amount,
    'currency', v_from_account.currency,
    'from_account', jsonb_build_object(
      'id', p_from_id,
      'account_number', v_from_account.account_number,
      'old_balance', v_from_account.balance,
      'new_balance', v_new_from_bal
    ),
    'to_account', jsonb_build_object(
      'id', p_to_id,
      'account_number', v_to_account.account_number,
      'old_balance', v_to_account.balance,
      'new_balance', v_new_to_bal
    ),
    'status', 'completed',
    'timestamp', NOW()
  );
END;
$$;
