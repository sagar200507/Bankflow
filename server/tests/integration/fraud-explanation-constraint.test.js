/**
 * ═══════════════════════════════════════════════════════════════
 *  Structural Constraint Test: Fraud Explanations
 * ═══════════════════════════════════════════════════════════════
 *
 * This test enforces the CRITICAL ARCHITECTURAL CONSTRAINT:
 * The LLM / Explanation flow MUST NEVER make or influence fraud
 * decisions, nor modify the `fraud_flags` table.
 *
 * It provides a behavioral guarantee by snapshotting the DB
 * before and after the full explanation flow.
 * ═══════════════════════════════════════════════════════════════
 */

const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/database');
const { generateTestToken } = require('../utils/testHelpers'); // Assuming standard test helper

describe('Architectural Constraint: Fraud Explanation Mutability', () => {
  let userToken;
  let transactionId;
  let initialFraudFlagsState = [];

  beforeAll(async () => {
    // 1. Setup a test user, account, transaction, and fraud flag
    const { rows: userRows } = await pool.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, role) 
       VALUES ('Constraint', 'Tester', 'constraint@test.com', 'hash', 'user') 
       RETURNING id`
    );
    const userId = userRows[0].id;
    userToken = generateTestToken({ id: userId, role: 'user' });

    const { rows: accountRows } = await pool.query(
      `INSERT INTO accounts (user_id, account_number, type, balance) 
       VALUES ($1, '9999999999', 'checking', 1000) 
       RETURNING id`,
      [userId]
    );

    const { rows: txnRows } = await pool.query(
      `INSERT INTO transactions (from_account_id, type, amount, status) 
       VALUES ($1, 'withdrawal', 50000, 'completed') 
       RETURNING id`,
      [accountRows[0].id]
    );
    transactionId = txnRows[0].id;

    await pool.query(
      `INSERT INTO fraud_flags (transaction_id, user_id, flag_type, severity, description, metadata) 
       VALUES ($1, $2, 'anomaly', 'high', 'Unusually large withdrawal', '{"threshold": 10000}')`,
      [transactionId, userId]
    );

    // 2. Snapshot the `fraud_flags` table BEFORE the test
    const { rows } = await pool.query(`SELECT id, is_resolved, resolution_note, metadata FROM fraud_flags ORDER BY id`);
    initialFraudFlagsState = rows;
  });

  afterAll(async () => {
    // Cleanup test data
    await pool.query(`DELETE FROM users WHERE email = 'constraint@test.com'`);
    await pool.end();
  });

  it('GUARANTEE: The explanation flow does not modify fraud_flags table', async () => {
    // Action: Trigger the LLM explanation flow
    const getRes = await request(app)
      .get(`/api/v1/transactions/${transactionId}/fraud-explanation`)
      .set('Authorization', `Bearer ${userToken}`);
    
    // It should succeed or fail gracefully (e.g. if API key missing), 
    // but what matters is the DB state.
    
    // Action: Trigger a follow-up question
    const postRes = await request(app)
      .post(`/api/v1/transactions/${transactionId}/fraud-explanation/ask`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ question: 'Why is this considered an anomaly?' });

    // Assertion: Snapshot the `fraud_flags` table AFTER the test
    const { rows: finalState } = await pool.query(`SELECT id, is_resolved, resolution_note, metadata FROM fraud_flags ORDER BY id`);
    
    // Constraint 1: Row count must be identical
    expect(finalState.length).toBe(initialFraudFlagsState.length);

    // Constraint 2: Contents must be identical (no stealth updates to resolution, metadata, etc.)
    for (let i = 0; i < initialFraudFlagsState.length; i++) {
      expect(finalState[i].id).toBe(initialFraudFlagsState[i].id);
      expect(finalState[i].is_resolved).toBe(initialFraudFlagsState[i].is_resolved);
      expect(finalState[i].resolution_note).toBe(initialFraudFlagsState[i].resolution_note);
      expect(finalState[i].metadata).toEqual(initialFraudFlagsState[i].metadata);
    }
  });
});
