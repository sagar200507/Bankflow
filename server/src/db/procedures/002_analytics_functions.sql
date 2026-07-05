-- ═══════════════════════════════════════════════════════════════
--  BankFlow — Analytics Functions (Window Functions)
-- ═══════════════════════════════════════════════════════════════
--
-- PostgreSQL window functions compute values across "windows"
-- (sets of related rows) WITHOUT collapsing them into a single
-- row like GROUP BY does.
--
-- Syntax:  function_name() OVER (PARTITION BY col ORDER BY col)
--
-- Key window functions used:
--   • SUM() OVER(...)     — running total within a partition
--   • ROW_NUMBER() OVER(...) — sequential numbering within groups
--   • LAG() OVER(...)     — access the previous row's value
--   • RANK() OVER(...)    — rank with gaps for ties
--   • DENSE_RANK()        — rank without gaps
-- ═══════════════════════════════════════════════════════════════


-- ──────────────────────────────────────────────────────────────
-- fn_monthly_spending: Monthly spending breakdown for a user
-- ──────────────────────────────────────────────────────────────
-- Uses DATE_TRUNC to group by month, then SUM for totals.
-- Window function LAG() computes month-over-month change.
-- 
-- Example output:
--   month      | total_spent | txn_count | pct_change
--   2026-01-01 | 45000.00    | 12        | NULL
--   2026-02-01 | 52000.00    | 15        | 15.56
--   2026-03-01 | 38000.00    | 9         | -26.92
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_monthly_spending(
  p_user_id UUID,
  p_months  INTEGER DEFAULT 6
)
RETURNS TABLE (
  month        DATE,
  total_spent  NUMERIC(15,2),
  txn_count    BIGINT,
  pct_change   NUMERIC(8,2)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH monthly AS (
    -- Group transactions by month where the user is the SENDER
    -- (withdrawals + transfers out = "spending")
    SELECT
      DATE_TRUNC('month', t.created_at)::DATE AS month,
      SUM(t.amount) AS total_spent,
      COUNT(*) AS txn_count
    FROM transactions t
    JOIN accounts a ON t.from_account_id = a.id
    WHERE a.user_id = p_user_id
      AND t.status = 'completed'
      AND t.created_at >= DATE_TRUNC('month', NOW()) - (p_months || ' months')::INTERVAL
    GROUP BY DATE_TRUNC('month', t.created_at)
    ORDER BY month
  )
  SELECT
    m.month,
    m.total_spent,
    m.txn_count,
    -- LAG(total_spent) looks at the PREVIOUS row's total_spent
    -- to compute percentage change month-over-month.
    -- First row has no previous → NULL.
    ROUND(
      ((m.total_spent - LAG(m.total_spent) OVER (ORDER BY m.month))
       / NULLIF(LAG(m.total_spent) OVER (ORDER BY m.month), 0)) * 100,
      2
    ) AS pct_change
  FROM monthly m;
END;
$$;


-- ──────────────────────────────────────────────────────────────
-- fn_transaction_trends: Daily transaction volume and amounts
-- ──────────────────────────────────────────────────────────────
-- Uses a running sum with window function to show cumulative
-- transaction volume over time.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_transaction_trends(
  p_user_id UUID,
  p_days    INTEGER DEFAULT 30
)
RETURNS TABLE (
  day             DATE,
  txn_count       BIGINT,
  total_amount    NUMERIC(15,2),
  cumulative_count BIGINT,
  avg_amount      NUMERIC(15,2)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH daily AS (
    SELECT
      DATE_TRUNC('day', t.created_at)::DATE AS day,
      COUNT(*) AS txn_count,
      SUM(t.amount) AS total_amount,
      AVG(t.amount) AS avg_amount
    FROM transactions t
    JOIN accounts a ON (t.from_account_id = a.id OR t.to_account_id = a.id)
    WHERE a.user_id = p_user_id
      AND t.status = 'completed'
      AND t.created_at >= CURRENT_DATE - p_days
    GROUP BY DATE_TRUNC('day', t.created_at)
    ORDER BY day
  )
  SELECT
    d.day,
    d.txn_count,
    d.total_amount,
    -- SUM() OVER (ORDER BY day) creates a running total:
    -- Day 1: 5, Day 2: 5+3=8, Day 3: 8+7=15
    SUM(d.txn_count) OVER (ORDER BY d.day) AS cumulative_count,
    ROUND(d.avg_amount, 2) AS avg_amount
  FROM daily d;
END;
$$;


-- ──────────────────────────────────────────────────────────────
-- fn_top_recipients: Most frequently transacted recipients
-- ──────────────────────────────────────────────────────────────
-- Uses DENSE_RANK() window function to rank recipients by
-- transaction count. DENSE_RANK (vs RANK) ensures no gaps
-- in ranking when there are ties.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_top_recipients(
  p_user_id UUID,
  p_limit   INTEGER DEFAULT 5
)
RETURNS TABLE (
  recipient_name    TEXT,
  account_number    VARCHAR(20),
  total_amount      NUMERIC(15,2),
  txn_count         BIGINT,
  rank              BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH recipient_stats AS (
    SELECT
      u.first_name || ' ' || u.last_name AS recipient_name,
      a_to.account_number,
      SUM(t.amount) AS total_amount,
      COUNT(*) AS txn_count
    FROM transactions t
    JOIN accounts a_from ON t.from_account_id = a_from.id
    JOIN accounts a_to ON t.to_account_id = a_to.id
    JOIN users u ON a_to.user_id = u.id
    WHERE a_from.user_id = p_user_id
      AND t.type = 'transfer'
      AND t.status = 'completed'
    GROUP BY u.first_name, u.last_name, a_to.account_number
  )
  SELECT
    rs.recipient_name,
    rs.account_number,
    rs.total_amount,
    rs.txn_count,
    -- DENSE_RANK: ties get same rank, next rank is +1 (no gaps)
    -- e.g., 1, 2, 2, 3 (not 1, 2, 2, 4 like RANK)
    DENSE_RANK() OVER (ORDER BY rs.txn_count DESC, rs.total_amount DESC) AS rank
  FROM recipient_stats rs
  ORDER BY rank
  LIMIT p_limit;
END;
$$;


-- ──────────────────────────────────────────────────────────────
-- fn_dashboard_stats: Aggregated KPI statistics for a user
-- ──────────────────────────────────────────────────────────────
-- Returns all dashboard KPI values in a single query to minimize
-- round trips. Uses subqueries instead of JOINs because each
-- stat comes from a different table/condition.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_dashboard_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_balance    NUMERIC(15,2);
  v_account_count    INTEGER;
  v_total_txns       INTEGER;
  v_monthly_spending NUMERIC(15,2);
  v_monthly_income   NUMERIC(15,2);
  v_fraud_flags      INTEGER;
  v_pending_txns     INTEGER;
BEGIN
  -- Total balance across all active accounts
  SELECT COALESCE(SUM(balance), 0)
  INTO v_total_balance
  FROM accounts
  WHERE user_id = p_user_id AND status = 'active';

  -- Number of accounts
  SELECT COUNT(*)
  INTO v_account_count
  FROM accounts
  WHERE user_id = p_user_id;

  -- Total completed transactions
  SELECT COUNT(DISTINCT t.id)
  INTO v_total_txns
  FROM transactions t
  JOIN accounts a ON (t.from_account_id = a.id OR t.to_account_id = a.id)
  WHERE a.user_id = p_user_id AND t.status = 'completed';

  -- Last 30 days spending (outgoing)
  SELECT COALESCE(SUM(t.amount), 0)
  INTO v_monthly_spending
  FROM transactions t
  JOIN accounts a ON t.from_account_id = a.id
  WHERE a.user_id = p_user_id
    AND t.status = 'completed'
    AND t.created_at >= NOW() - INTERVAL '30 days';

  -- Last 30 days income (incoming)
  SELECT COALESCE(SUM(t.amount), 0)
  INTO v_monthly_income
  FROM transactions t
  JOIN accounts a ON t.to_account_id = a.id
  WHERE a.user_id = p_user_id
    AND t.status = 'completed'
    AND t.created_at >= NOW() - INTERVAL '30 days';

  -- Unresolved fraud flags
  SELECT COUNT(*)
  INTO v_fraud_flags
  FROM fraud_flags ff
  WHERE ff.user_id = p_user_id AND ff.is_resolved = FALSE;

  -- Pending transactions
  SELECT COUNT(DISTINCT t.id)
  INTO v_pending_txns
  FROM transactions t
  JOIN accounts a ON (t.from_account_id = a.id OR t.to_account_id = a.id)
  WHERE a.user_id = p_user_id AND t.status = 'pending';

  RETURN jsonb_build_object(
    'total_balance', v_total_balance,
    'account_count', v_account_count,
    'total_transactions', v_total_txns,
    'monthly_spending', v_monthly_spending,
    'monthly_income', v_monthly_income,
    'fraud_flags', v_fraud_flags,
    'pending_transactions', v_pending_txns
  );
END;
$$;
