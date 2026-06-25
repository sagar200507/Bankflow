/**
 * ═══════════════════════════════════════════════════════════════
 *  k6 Test: Full End-to-End User Journey
 * ═══════════════════════════════════════════════════════════════
 *
 * Simulates a complete user session:
 *   1. Register
 *   2. Login
 *   3. Create savings account
 *   4. Deposit salary
 *   5. View dashboard
 *   6. Create second account
 *   7. Transfer between accounts
 *   8. View transaction history
 *   9. Check analytics
 *
 * This represents the MOST REALISTIC load pattern — what actual
 * users do in the application over a single session.
 *
 * Run:   k6 run --env SCENARIO=load k6/e2e.test.js
 * ═══════════════════════════════════════════════════════════════
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend } from 'k6/metrics';
import { BASE_URL, authHeaders, randomEmail, randomAmount, SCENARIOS, DEFAULT_THRESHOLDS } from './helpers.js';

// ── Custom Metrics ────────────────────────────────────────────
const dashboardDuration = new Trend('bankflow_dashboard_duration', true);
const analyticsDuration = new Trend('bankflow_analytics_duration', true);
const e2eDuration = new Trend('bankflow_e2e_journey_duration', true);

const scenario = __ENV.SCENARIO || 'smoke';

export const options = {
  scenarios: {
    e2e_journey: SCENARIOS[scenario] || SCENARIOS.smoke,
  },
  thresholds: {
    ...DEFAULT_THRESHOLDS,
    bankflow_dashboard_duration: ['p(95)<600'],
    bankflow_analytics_duration: ['p(95)<800'],
    bankflow_e2e_journey_duration: ['p(95)<8000'],
  },
};

export default function () {
  const startTime = Date.now();
  const email = randomEmail();
  const password = 'LoadTest@123';
  let token = '';
  let account1 = '';
  let account2 = '';

  // ── 1. Register ─────────────────────────────────────────────
  group('1. Register', () => {
    const res = http.post(
      `${BASE_URL}/auth/register`,
      JSON.stringify({ firstName: 'E2E', lastName: 'User', email, password }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    check(res, { 'register: 201': (r) => r.status === 201 });
    if (res.status === 201) token = res.json().data.accessToken;
  });

  if (!token) return;
  sleep(0.5);

  // ── 2. Login ────────────────────────────────────────────────
  group('2. Login', () => {
    const res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email, password }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    check(res, { 'login: 200': (r) => r.status === 200 });
    if (res.status === 200) token = res.json().data.accessToken;
  });

  sleep(0.3);

  // ── 3. Create Savings Account ───────────────────────────────
  group('3. Create Savings', () => {
    const res = http.post(
      `${BASE_URL}/accounts`,
      JSON.stringify({ accountType: 'savings' }),
      authHeaders(token)
    );

    check(res, { 'create savings: 201': (r) => r.status === 201 });
    if (res.status === 201) account1 = res.json().data.account.id;
  });

  if (!account1) return;
  sleep(0.3);

  // ── 4. Deposit Salary ───────────────────────────────────────
  group('4. Deposit Salary', () => {
    const res = http.post(
      `${BASE_URL}/accounts/${account1}/deposit`,
      JSON.stringify({ amount: 75000, description: 'Monthly salary' }),
      authHeaders(token)
    );

    check(res, {
      'deposit: success': (r) => r.status === 200 || r.status === 201,
    });
  });

  sleep(0.5);

  // ── 5. View Dashboard ───────────────────────────────────────
  group('5. View Dashboard', () => {
    const res = http.get(`${BASE_URL}/analytics/dashboard`, authHeaders(token));

    dashboardDuration.add(res.timings.duration);

    check(res, {
      'dashboard: 200': (r) => r.status === 200,
      'dashboard: has stats': (r) => r.json()?.data?.stats !== undefined,
    });
  });

  sleep(0.3);

  // ── 6. Create Checking Account ──────────────────────────────
  group('6. Create Checking', () => {
    const res = http.post(
      `${BASE_URL}/accounts`,
      JSON.stringify({ accountType: 'checking' }),
      authHeaders(token)
    );

    check(res, { 'create checking: 201': (r) => r.status === 201 });
    if (res.status === 201) account2 = res.json().data.account.id;
  });

  if (!account2) return;
  sleep(0.3);

  // ── 7. Transfer Between Accounts ────────────────────────────
  group('7. Transfer Funds', () => {
    const res = http.post(
      `${BASE_URL}/transactions/transfer`,
      JSON.stringify({
        fromAccountId: account1,
        toAccountId: account2,
        amount: 15000,
        description: 'Move to checking',
      }),
      authHeaders(token)
    );

    check(res, {
      'transfer: success': (r) => r.status === 200 || r.status === 201,
      'transfer: has ref number': (r) => r.json()?.data?.transaction?.reference_number !== undefined,
    });
  });

  sleep(0.3);

  // ── 8. View Transaction History ─────────────────────────────
  group('8. Transaction History', () => {
    const res = http.get(
      `${BASE_URL}/transactions/account/${account1}?page=1&limit=10`,
      authHeaders(token)
    );

    check(res, {
      'history: 200': (r) => r.status === 200,
      'history: has transactions': (r) => {
        const txns = r.json()?.data?.transactions;
        return Array.isArray(txns) && txns.length >= 2; // deposit + transfer
      },
    });
  });

  sleep(0.3);

  // ── 9. View Spending Analytics ──────────────────────────────
  group('9. Analytics', () => {
    const res = http.get(
      `${BASE_URL}/analytics/spending?months=6`,
      authHeaders(token)
    );

    analyticsDuration.add(res.timings.duration);

    check(res, {
      'analytics: 200': (r) => r.status === 200,
    });
  });

  // ── Record total journey time ───────────────────────────────
  e2eDuration.add(Date.now() - startTime);

  sleep(1);
}
