-- ═══════════════════════════════════════════════════════════════
--  005: Ledger Entries Table
-- ═══════════════════════════════════════════════════════════════
--  Separates the business event (transactions table) from the 
--  accounting impact (ledger_entries). Implements double-entry.
-- ═══════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE ledger_entry_type AS ENUM ('DEBIT', 'CREDIT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  entry_type ledger_entry_type NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  balance_after NUMERIC(15, 2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_ledger_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_ledger_account ON ledger_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_transaction ON ledger_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON ledger_entries USING BRIN(created_at);

DO $$
DECLARE
  mismatch_record RECORD;
BEGIN
  -- Only backfill if the table is empty to avoid duplicating data on re-runs
  IF (SELECT COUNT(*) FROM ledger_entries) = 0 THEN
    
    -- 1. Deposits -> CREDIT for receiver
    INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount, balance_after, description, created_at)
    SELECT id, to_account_id, 'CREDIT', amount, COALESCE(balance_after, 0), description, created_at
    FROM transactions 
    WHERE type = 'deposit' AND to_account_id IS NOT NULL;

    -- 2. Withdrawals -> DEBIT for sender
    INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount, balance_after, description, created_at)
    SELECT id, from_account_id, 'DEBIT', amount, COALESCE(balance_after, 0), description, created_at
    FROM transactions 
    WHERE type = 'withdrawal' AND from_account_id IS NOT NULL;

    -- 3. Transfers -> DEBIT for sender
    INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount, balance_after, description, created_at)
    SELECT id, from_account_id, 'DEBIT', amount, COALESCE(balance_after, 0), description, created_at
    FROM transactions 
    WHERE type = 'transfer' AND from_account_id IS NOT NULL;

    -- 4. Transfers -> CREDIT for receiver
    -- Historically, 'balance_after' in transfers is the SENDER'S balance, not the receiver's.
    -- We set it to 0.00 since the historical snapshot was lost in the single-record system.
    INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount, balance_after, description, created_at)
    SELECT id, to_account_id, 'CREDIT', amount, 0.00, description, created_at
    FROM transactions 
    WHERE type = 'transfer' AND to_account_id IS NOT NULL;
    
    -- Validation: Check reconstructed ledger balances vs current account balances
    FOR mismatch_record IN
      SELECT a.id, a.account_number, a.balance AS current_balance,
             COALESCE(SUM(CASE WHEN le.entry_type = 'CREDIT' THEN le.amount ELSE -le.amount END), 0) AS calculated_balance
      FROM accounts a
      LEFT JOIN ledger_entries le ON a.id = le.account_id
      GROUP BY a.id, a.account_number, a.balance
      HAVING a.balance != COALESCE(SUM(CASE WHEN le.entry_type = 'CREDIT' THEN le.amount ELSE -le.amount END), 0)
    LOOP
      RAISE WARNING 'Ledger reconstruction mismatch for Account %: current balance = %, ledger calculated = %', 
        mismatch_record.account_number, mismatch_record.current_balance, mismatch_record.calculated_balance;
    END LOOP;

  END IF;
END $$;
