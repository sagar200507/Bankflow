/**
 * ═══════════════════════════════════════════════════════════════
 *  k6 Helpers — Shared utilities across all load test scripts
 * ═══════════════════════════════════════════════════════════════
 */

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000/api/v1';

/**
 * Default headers for authenticated requests.
 * @param {string} token - JWT access token
 */
export function authHeaders(token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  };
}

/**
 * Generate a random email for user registration.
 */
export function randomEmail() {
  const id = Math.random().toString(36).substring(2, 10);
  return `loadtest_${id}_${Date.now()}@bankflow.test`;
}

/**
 * Generate random amount between min and max.
 */
export function randomAmount(min = 100, max = 10000) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

/**
 * Common k6 thresholds for BankFlow APIs.
 *
 * p(95) < 500ms  — 95th percentile under 500ms
 * p(99) < 1500ms — 99th percentile under 1.5s
 * rate > 0.95    — 95% of requests succeed
 *
 * These are production-grade SLOs (Service Level Objectives).
 */
export const DEFAULT_THRESHOLDS = {
  http_req_duration: ['p(95)<500', 'p(99)<1500'],
  http_req_failed: ['rate<0.05'],
  http_reqs: ['rate>10'],
};

/**
 * Predefined test scenarios.
 *
 * SMOKE:  1-2 VUs for 30s — verify the API works under minimal load.
 * LOAD:   50 VUs ramped over 5min — normal production traffic.
 * STRESS: 200 VUs ramped over 10min — find the breaking point.
 * SPIKE:  0→200 VUs instantly — simulate a sudden traffic spike.
 */
export const SCENARIOS = {
  smoke: {
    executor: 'constant-vus',
    vus: 2,
    duration: '30s',
  },
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 20 },   // ramp up
      { duration: '3m', target: 50 },   // sustain
      { duration: '1m', target: 0 },    // ramp down
    ],
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 50 },
      { duration: '3m', target: 100 },
      { duration: '3m', target: 200 },
      { duration: '2m', target: 0 },
    ],
  },
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10s', target: 200 },  // instant spike
      { duration: '1m', target: 200 },   // sustain
      { duration: '10s', target: 0 },    // drop
    ],
  },
};
