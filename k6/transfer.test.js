/**
 * ═══════════════════════════════════════════════════════════════
 *  k6 Test: Transfer (Concurrent Stress)
 * ═══════════════════════════════════════════════════════════════
 *
 * This is the MOST IMPORTANT load test in BankFlow.
 *
 * Transfers are the highest-risk operation because they:
 *   1. Lock TWO accounts (deadlock risk)
 *   2. Modify TWO balances (consistency risk)
 *   3. Create a transaction record (atomicity)
 *   4. Trigger fraud detection (async overhead)
 *
 * This test creates a pair of accounts per VU and performs
 * rapid back-and-forth transfers to stress-test:
 *   • Row-level locking (FOR UPDATE)
 *   • Deadlock prevention (sorted lock ordering)
 *   • ACID transaction integrity
 *   • Connection pool exhaustion
 *
 * EXPECTED BEHAVIOR:
 *   • Under smoke: 0 errors, p95 < 500ms
 *   • Under load: < 1% errors, p95 < 800ms
 *   • Under stress: some timeouts, no data corruption
 *   • Under spike: connection pool may saturate → 503s
 *
 * Run:   k6 run --env SCENARIO=load k6/transfer.test.js
 * ═══════════════════════════════════════════════════════════════
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import { BASE_URL, authHeaders, randomEmail, randomAmount, SCENARIOS, DEFAULT_THRESHOLDS } from './helpers.js';

// ── Custom Metrics ────────────────────────────────────────────
const transferDuration = new Trend('bankflow_transfer_duration', true);
const transferErrors = new Counter('bankflow_transfer_errors');
const transferSuccess = new Rate('bankflow_transfer_success_rate');

const scenario = __ENV.SCENARIO || 'smoke';

export const options = {
  scenarios: {
    transfer_stress: SCENARIOS[scenario] || SCENARIOS.smoke,
  },
  thresholds: {
    ...DEFAULT_THRESHOLDS,
    bankflow_transfer_duration: ['p(95)<800', 'p(99)<2000'],
    bankflow_transfer_success_rate: ['rate>0.90'],
  },
};

export default function () {
  const email = randomEmail();
  const password = 'LoadTest@123';
  let accessToken = '';
  let accountA = '';
  let accountB = '';

  // ── Setup: Register + Create 2 Accounts + Seed Funds ──────
  group('Setup', () => {
    // Register
    const regRes = http.post(
      `${BASE_URL}/auth/register`,
      JSON.stringify({ firstName: 'Transfer', lastName: 'Tester', email, password }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (regRes.status !== 201) {
      transferErrors.add(1);
      return;
    }
    accessToken = regRes.json().data.accessToken;

    // Create Account A (savings)
    const accARes = http.post(
      `${BASE_URL}/accounts`,
      JSON.stringify({ accountType: 'savings' }),
      authHeaders(accessToken)
    );
    if (accARes.status === 201) {
      accountA = accARes.json().data.account.id;
    }

    // Create Account B (checking)
    const accBRes = http.post(
      `${BASE_URL}/accounts`,
      JSON.stringify({ accountType: 'checking' }),
      authHeaders(accessToken)
    );
    if (accBRes.status === 201) {
      accountB = accBRes.json().data.account.id;
    }

    if (!accountA || !accountB) {
      transferErrors.add(1);
      return;
    }

    // Seed Account A with funds
    http.post(
      `${BASE_URL}/accounts/${accountA}/deposit`,
      JSON.stringify({ amount: 100000, description: 'k6 seed' }),
      authHeaders(accessToken)
    );

    // Seed Account B with funds
    http.post(
      `${BASE_URL}/accounts/${accountB}/deposit`,
      JSON.stringify({ amount: 100000, description: 'k6 seed' }),
      authHeaders(accessToken)
    );
  });

  if (!accessToken || !accountA || !accountB) return;
  sleep(0.5);

  // ── Transfer A → B ──────────────────────────────────────────
  group('Transfer A→B', () => {
    const amount = randomAmount(100, 5000);

    const res = http.post(
      `${BASE_URL}/transactions/transfer`,
      JSON.stringify({
        fromAccountId: accountA,
        toAccountId: accountB,
        amount,
        description: 'k6 transfer A→B',
      }),
      authHeaders(accessToken)
    );

    transferDuration.add(res.timings.duration);

    const success = check(res, {
      'transfer A→B: status 200/201': (r) => r.status === 200 || r.status === 201,
      'transfer A→B: has transaction': (r) => r.json()?.data?.transaction?.id !== undefined,
    });

    transferSuccess.add(success ? 1 : 0);
    if (!success) transferErrors.add(1);
  });

  sleep(0.3);

  // ── Transfer B → A (reverse direction) ──────────────────────
  group('Transfer B→A', () => {
    const amount = randomAmount(100, 3000);

    const res = http.post(
      `${BASE_URL}/transactions/transfer`,
      JSON.stringify({
        fromAccountId: accountB,
        toAccountId: accountA,
        amount,
        description: 'k6 transfer B→A',
      }),
      authHeaders(accessToken)
    );

    transferDuration.add(res.timings.duration);

    const success = check(res, {
      'transfer B→A: status 200/201': (r) => r.status === 200 || r.status === 201,
      'transfer B→A: has transaction': (r) => r.json()?.data?.transaction?.id !== undefined,
    });

    transferSuccess.add(success ? 1 : 0);
    if (!success) transferErrors.add(1);
  });

  sleep(0.3);

  // ── Verify Consistency ──────────────────────────────────────
  // After A→B and B→A, total balance should still = 200,000
  group('Verify Balances', () => {
    const aRes = http.get(`${BASE_URL}/accounts/${accountA}`, authHeaders(accessToken));
    const bRes = http.get(`${BASE_URL}/accounts/${accountB}`, authHeaders(accessToken));

    if (aRes.status === 200 && bRes.status === 200) {
      const balA = parseFloat(aRes.json()?.data?.account?.balance || 0);
      const balB = parseFloat(bRes.json()?.data?.account?.balance || 0);
      const total = balA + balB;

      check(null, {
        'consistency: total balance = 200000': () => Math.abs(total - 200000) < 0.01,
        'consistency: no negative balances': () => balA >= 0 && balB >= 0,
      });
    }
  });

  sleep(1);
}
