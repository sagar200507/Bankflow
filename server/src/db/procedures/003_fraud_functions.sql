-- ═══════════════════════════════════════════════════════════════
--  BankFlow — Fraud Detection SQL Functions
-- ═══════════════════════════════════════════════════════════════
--
-- Server-side fraud detection queries that run inside PostgreSQL
-- for maximum performance. These are called by the Node.js
-- fraud detection service after each transaction.
-- ═══════════════════════════════════════════════════════════════


-- ──────────────────────────────────────────────────────────────
-- fn_velocity_check: Count transactions in a time window
-- ──────────────────────────────────────────────────────────────
-- Returns the number of transactions a user has made in the
-- last N minutes. If this exceeds a threshold, flag as fraud.
--
-- WHY SQL instead of application code?
--   Counting in the DB avoids fetching thousands of rows to Node.js
--   just to call .length. The DB engine uses the BRIN index on
--   created_at for efficient time-range scans.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_velocity_check(
  p_user_id       UUID,
  p_window_minutes INTEGER DEFAULT 5
)
RETURNS TABLE (
  txn_count    BIGINT,
  window_start TIMESTAMPTZ,
  window_end   TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT t.id) AS txn_count,
    (NOW() - (p_window_minutes || ' minutes')::INTERVAL) AS window_start,
    NOW() AS window_end
  FROM transactions t
  JOIN accounts a ON (t.from_account_id = a.id OR t.to_account_id = a.id)
  WHERE a.user_id = p_user_id
    AND t.created_at >= NOW() - (p_window_minutes || ' minutes')::INTERVAL;
END;
$$;


-- ──────────────────────────────────────────────────────────────
-- fn_anomaly_check: Detect unusual transaction amounts
-- ──────────────────────────────────────────────────────────────
-- Compares the given amount against the user's historical average.
-- If amount > N × average, it's flagged as an anomaly.
--
-- Uses window function AVG() to compute the rolling average of
-- the user's last 50 transactions for a more stable baseline.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_anomaly_check(
  p_user_id    UUID,
  p_amount     NUMERIC(15,2),
  p_multiplier NUMERIC DEFAULT 3.0
)
RETURNS TABLE (
  is_anomaly   BOOLEAN,
  avg_amount   NUMERIC(15,2),
  threshold    NUMERIC(15,2),
  given_amount NUMERIC(15,2),
  txn_history_count BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_avg NUMERIC(15,2);
  v_count BIGINT;
BEGIN
  -- Calculate average from the user's last 50 completed transactions
  SELECT
    COALESCE(AVG(sub.amount), 0),
    COUNT(*)
  INTO v_avg, v_count
  FROM (
    SELECT t.amount
    FROM transactions t
    JOIN accounts a ON (t.from_account_id = a.id OR t.to_account_id = a.id)
    WHERE a.user_id = p_user_id
      AND t.status = 'completed'
    ORDER BY t.created_at DESC
    LIMIT 50
  ) sub;

  -- If user has fewer than 5 transactions, don't flag anomalies
  -- (insufficient data for a meaningful average)
  IF v_count < 5 THEN
    RETURN QUERY SELECT FALSE, v_avg, v_avg * p_multiplier, p_amount, v_count;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p_amount > (v_avg * p_multiplier) AS is_anomaly,
    v_avg,
    ROUND(v_avg * p_multiplier, 2) AS threshold,
    p_amount,
    v_count;
END;
$$;


-- ──────────────────────────────────────────────────────────────
-- fn_geo_consistency_check: Detect geographic inconsistency
-- ──────────────────────────────────────────────────────────────
-- Checks if the current IP address matches the user's recent
-- transaction IP addresses. If the IP subnet differs from
-- the last 10 transactions, flag as suspicious.
--
-- NOTE: This is a simplified check (IP prefix comparison).
-- Production systems would use GeoIP databases for lat/lon
-- distance calculation.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_geo_consistency_check(
  p_user_id    UUID,
  p_ip_address INET
)
RETURNS TABLE (
  is_inconsistent BOOLEAN,
  current_ip      INET,
  recent_ips      INET[],
  match_count     BIGINT,
  total_recent    BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_recent_ips INET[];
  v_match_count BIGINT;
  v_total BIGINT;
BEGIN
  -- Get the last 10 distinct IPs used by this user
  SELECT ARRAY_AGG(DISTINCT sub.ip), COUNT(DISTINCT sub.ip)
  INTO v_recent_ips, v_total
  FROM (
    SELECT t.ip_address AS ip
    FROM transactions t
    JOIN accounts a ON (t.from_account_id = a.id)
    WHERE a.user_id = p_user_id
      AND t.ip_address IS NOT NULL
    ORDER BY t.created_at DESC
    LIMIT 10
  ) sub;

  -- If no history, no inconsistency to detect
  IF v_total = 0 OR v_recent_ips IS NULL THEN
    RETURN QUERY SELECT FALSE, p_ip_address, v_recent_ips, 0::BIGINT, 0::BIGINT;
    RETURN;
  END IF;

  -- Count how many recent IPs share the same /24 subnet as the current IP
  -- A /24 means the first 3 octets match (e.g., 192.168.1.x)
  SELECT COUNT(*)
  INTO v_match_count
  FROM UNNEST(v_recent_ips) AS recent_ip
  WHERE masklen(recent_ip) IS NOT NULL
    AND network(set_masklen(recent_ip, 24)) = network(set_masklen(p_ip_address, 24));

  RETURN QUERY
  SELECT
    v_match_count = 0 AS is_inconsistent, -- No matching subnet = suspicious
    p_ip_address,
    v_recent_ips,
    v_match_count,
    v_total;
END;
$$;
