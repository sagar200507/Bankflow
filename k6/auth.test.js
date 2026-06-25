/**
 * ═══════════════════════════════════════════════════════════════
 *  k6 Test: Authentication Flow
 * ═══════════════════════════════════════════════════════════════
 *
 * Tests the full auth lifecycle:
 *   1. Register a new user
 *   2. Login with credentials
 *   3. Get profile (authenticated)
 *   4. Refresh token
 *
 * Run:   k6 run --env SCENARIO=smoke k6/auth.test.js
 * Scenarios: smoke | load | stress | spike
 * ═══════════════════════════════════════════════════════════════
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { BASE_URL, authHeaders, randomEmail, SCENARIOS, DEFAULT_THRESHOLDS } from './helpers.js';

// ── Custom Metrics ────────────────────────────────────────────
const registerDuration = new Trend('bankflow_register_duration', true);
const loginDuration = new Trend('bankflow_login_duration', true);
const profileDuration = new Trend('bankflow_profile_duration', true);
const authErrors = new Counter('bankflow_auth_errors');

// ── Scenario Selection ────────────────────────────────────────
const scenario = __ENV.SCENARIO || 'smoke';

export const options = {
  scenarios: {
    auth_flow: SCENARIOS[scenario] || SCENARIOS.smoke,
  },
  thresholds: {
    ...DEFAULT_THRESHOLDS,
    bankflow_register_duration: ['p(95)<800'],
    bankflow_login_duration: ['p(95)<300'],
    bankflow_profile_duration: ['p(95)<200'],
  },
};

// ── Test Logic ────────────────────────────────────────────────
export default function () {
  const email = randomEmail();
  const password = 'LoadTest@123';
  let accessToken = '';
  let refreshToken = '';

  // ── 1. Register ─────────────────────────────────────────────
  group('Register', () => {
    const payload = JSON.stringify({
      firstName: 'Load',
      lastName: 'Tester',
      email,
      password,
    });

    const res = http.post(`${BASE_URL}/auth/register`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    registerDuration.add(res.timings.duration);

    const success = check(res, {
      'register: status 201': (r) => r.status === 201,
      'register: has accessToken': (r) => {
        const body = r.json();
        return body?.data?.accessToken !== undefined;
      },
    });

    if (success) {
      const body = res.json();
      accessToken = body.data.accessToken;
      refreshToken = body.data.refreshToken;
    } else {
      authErrors.add(1);
    }
  });

  sleep(0.5);

  // ── 2. Login ────────────────────────────────────────────────
  group('Login', () => {
    const payload = JSON.stringify({ email, password });

    const res = http.post(`${BASE_URL}/auth/login`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    loginDuration.add(res.timings.duration);

    const success = check(res, {
      'login: status 200': (r) => r.status === 200,
      'login: has tokens': (r) => {
        const body = r.json();
        return body?.data?.accessToken && body?.data?.refreshToken;
      },
    });

    if (success) {
      const body = res.json();
      accessToken = body.data.accessToken;
      refreshToken = body.data.refreshToken;
    } else {
      authErrors.add(1);
    }
  });

  sleep(0.3);

  // ── 3. Get Profile ──────────────────────────────────────────
  group('Get Profile', () => {
    const res = http.get(`${BASE_URL}/auth/me`, authHeaders(accessToken));

    profileDuration.add(res.timings.duration);

    const success = check(res, {
      'profile: status 200': (r) => r.status === 200,
      'profile: has user data': (r) => {
        const body = r.json();
        return body?.data?.user?.email === email;
      },
    });

    if (!success) authErrors.add(1);
  });

  sleep(0.3);

  // ── 4. Refresh Token ────────────────────────────────────────
  group('Refresh Token', () => {
    const payload = JSON.stringify({ refreshToken });

    const res = http.post(`${BASE_URL}/auth/refresh`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    check(res, {
      'refresh: status 200': (r) => r.status === 200,
      'refresh: new tokens': (r) => {
        const body = r.json();
        return body?.data?.accessToken !== undefined;
      },
    });
  });

  sleep(1);
}
