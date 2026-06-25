/**
 * ═══════════════════════════════════════════════════════════════
 *  k6 Test: Banking Operations
 * ═══════════════════════════════════════════════════════════════
 *
 * Tests the core banking flow:
 *   1. Register + Login (setup)
 *   2. Create account
 *   3. Deposit funds
 *   4. Withdraw funds
 *   5. Get account balance
 *   6. Get transaction history
 *
 * This test exercises the ACID transaction paths with row-level
 * locking (FOR UPDATE) under concurrent load.
 *
 * Run:   k6 run --env SCENARIO=load k6/banking.test.js
 * ═══════════════════════════════════════════════════════════════
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { BASE_URL, authHeaders, randomEmail, randomAmount, SCENARIOS, DEFAULT_THRESHOLDS } from './helpers.js';

// ── Custom Metrics ────────────────────────────────────────────
const createAccountDuration = new Trend('bankflow_create_account_duration', true);
const depositDuration = new Trend('bankflow_deposit_duration', true);
const withdrawDuration = new Trend('bankflow_withdraw_duration', true);
const balanceDuration = new Trend('bankflow_balance_duration', true);
const txnHistoryDuration = new Trend('bankflow_txn_history_duration', true);
const bankingErrors = new Counter('bankflow_banking_errors');

const scenario = __ENV.SCENARIO || 'smoke';

export const options = {
  scenarios: {
    banking_flow: SCENARIOS[scenario] || SCENARIOS.smoke,
  },
  thresholds: {
    ...DEFAULT_THRESHOLDS,
    bankflow_create_account_duration: ['p(95)<400'],
    bankflow_deposit_duration: ['p(95)<600'],    // ACID transaction
    bankflow_withdraw_duration: ['p(95)<600'],   // ACID transaction
    bankflow_balance_duration: ['p(95)<200'],    // cached read
    bankflow_txn_history_duration: ['p(95)<300'],
  },
};

// ── Setup: Register + Login once per VU ───────────────────────
export function setup() {
  // Create a shared test user for all VUs to login with
  // In a real scenario, each VU would have its own user
  return { note: 'Each VU registers its own user in the default function' };
}

export default function () {
  const email = randomEmail();
  const password = 'LoadTest@123';
  let accessToken = '';
  let accountId = '';

  // ── Setup: Register + Login ─────────────────────────────────
  group('Setup: Auth', () => {
    const regRes = http.post(
      `${BASE_URL}/auth/register`,
      JSON.stringify({ firstName: 'Load', lastName: 'Test', email, password }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (regRes.status === 201) {
      accessToken = regRes.json().data.accessToken;
    } else {
      // Try login if user already exists
      const loginRes = http.post(
        `${BASE_URL}/auth/login`,
        JSON.stringify({ email, password }),
        { headers: { 'Content-Type': 'application/json' } }
      );
      if (loginRes.status === 200) {
        accessToken = loginRes.json().data.accessToken;
      } else {
        bankingErrors.add(1);
        return;
      }
    }
  });

  if (!accessToken) return;
  sleep(0.2);

  // ── 1. Create Account ──────────────────────────────────────
  group('Create Account', () => {
    const types = ['savings', 'checking', 'business'];
    const accountType = types[Math.floor(Math.random() * types.length)];

    const res = http.post(
      `${BASE_URL}/accounts`,
      JSON.stringify({ accountType }),
      authHeaders(accessToken)
    );

    createAccountDuration.add(res.timings.duration);

    const success = check(res, {
      'create account: status 201': (r) => r.status === 201,
      'create account: has id': (r) => r.json()?.data?.account?.id !== undefined,
    });

    if (success) {
      accountId = res.json().data.account.id;
    } else {
      bankingErrors.add(1);
    }
  });

  if (!accountId) return;
  sleep(0.3);

  // ── 2. Deposit ──────────────────────────────────────────────
  group('Deposit', () => {
    const amount = randomAmount(1000, 50000);

    const res = http.post(
      `${BASE_URL}/accounts/${accountId}/deposit`,
      JSON.stringify({ amount, description: 'k6 load test deposit' }),
      authHeaders(accessToken)
    );

    depositDuration.add(res.timings.duration);

    const success = check(res, {
      'deposit: status 200': (r) => r.status === 200 || r.status === 201,
      'deposit: transaction created': (r) => r.json()?.data?.transaction?.id !== undefined,
    });

    if (!success) bankingErrors.add(1);
  });

  sleep(0.3);

  // ── 3. Withdraw ─────────────────────────────────────────────
  group('Withdraw', () => {
    const amount = randomAmount(100, 500);

    const res = http.post(
      `${BASE_URL}/accounts/${accountId}/withdraw`,
      JSON.stringify({ amount, description: 'k6 load test withdrawal' }),
      authHeaders(accessToken)
    );

    withdrawDuration.add(res.timings.duration);

    const success = check(res, {
      'withdraw: status 200': (r) => r.status === 200 || r.status === 201,
      'withdraw: transaction created': (r) => r.json()?.data?.transaction?.id !== undefined,
    });

    if (!success) bankingErrors.add(1);
  });

  sleep(0.2);

  // ── 4. Get Account (Balance) ────────────────────────────────
  group('Get Balance', () => {
    const res = http.get(
      `${BASE_URL}/accounts/${accountId}`,
      authHeaders(accessToken)
    );

    balanceDuration.add(res.timings.duration);

    check(res, {
      'balance: status 200': (r) => r.status === 200,
      'balance: has balance field': (r) => r.json()?.data?.account?.balance !== undefined,
    });
  });

  sleep(0.2);

  // ── 5. Transaction History ──────────────────────────────────
  group('Transaction History', () => {
    const res = http.get(
      `${BASE_URL}/transactions/account/${accountId}?page=1&limit=10`,
      authHeaders(accessToken)
    );

    txnHistoryDuration.add(res.timings.duration);

    check(res, {
      'history: status 200': (r) => r.status === 200,
      'history: has transactions': (r) => Array.isArray(r.json()?.data?.transactions),
    });
  });

  sleep(1);
}
