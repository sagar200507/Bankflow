/**
 * ═══════════════════════════════════════════════════════════════
 *  BankFlow — Database Seed Runner
 * ═══════════════════════════════════════════════════════════════
 *
 * Populates the database with realistic sample data for
 * development and demo purposes.
 *
 * Usage: npm run db:seed
 *
 * IMPORTANT: Seeds are NOT idempotent — run only once after
 * a fresh migration. To re-seed, drop and recreate the DB:
 *   DROP DATABASE bankflow; CREATE DATABASE bankflow;
 *   npm run db:migrate && npm run db:seed
 */
const pool = require('../../config/database');
const logger = require('../../utils/logger');
const bcrypt = require('bcrypt');
const config = require('../../config');

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── 1. Create Users ────────────────────────────────────────
    // Bcrypt hash with salt rounds from config.
    // "$2b$12$..." prefix indicates bcrypt version 2b with 12 rounds.
    const passwordHash = await bcrypt.hash('Password@123', config.bcryptSaltRounds);

    const usersResult = await client.query(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, phone, role, is_verified)
      VALUES
        (gen_random_uuid(), 'admin@bankflow.com',    $1, 'Admin',   'User',    '+91-9876543210', 'admin',   TRUE),
        (gen_random_uuid(), 'rahul@bankflow.com',    $1, 'Rahul',   'Sharma',  '+91-9876543211', 'user',    TRUE),
        (gen_random_uuid(), 'priya@bankflow.com',    $1, 'Priya',   'Patel',   '+91-9876543212', 'user',    TRUE),
        (gen_random_uuid(), 'arjun@bankflow.com',    $1, 'Arjun',   'Verma',   '+91-9876543213', 'user',    TRUE),
        (gen_random_uuid(), 'sneha@bankflow.com',    $1, 'Sneha',   'Gupta',   '+91-9876543214', 'user',    TRUE),
        (gen_random_uuid(), 'auditor@bankflow.com',  $1, 'Audit',   'Officer', '+91-9876543215', 'auditor', TRUE)
      RETURNING id, email, role
    `, [passwordHash]);

    const users = usersResult.rows;
    logger.info(`✅ Seeded ${users.length} users`);

    // ── 2. Create Accounts ─────────────────────────────────────
    // Each user gets 1-2 accounts. Account numbers are 12-digit strings.
    const accountInserts = [];
    const accountValues = [];
    let paramIdx = 1;

    const accountData = [
      // Rahul — savings + checking
      { userId: users[1].id, num: '100000000001', type: 'savings',  balance: 124500.00 },
      { userId: users[1].id, num: '100000000002', type: 'checking', balance: 45200.50 },
      // Priya — savings
      { userId: users[2].id, num: '100000000003', type: 'savings',  balance: 89750.00 },
      // Arjun — savings + business
      { userId: users[3].id, num: '100000000004', type: 'savings',  balance: 215000.00 },
      { userId: users[3].id, num: '100000000005', type: 'business', balance: 567800.00 },
      // Sneha — checking
      { userId: users[4].id, num: '100000000006', type: 'checking', balance: 33400.00 },
    ];

    for (const acc of accountData) {
      accountInserts.push(
        `(gen_random_uuid(), $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`
      );
      accountValues.push(acc.userId, acc.num, acc.type, acc.balance);
    }

    const accountsResult = await client.query(`
      INSERT INTO accounts (id, user_id, account_number, account_type, balance)
      VALUES ${accountInserts.join(', ')}
      RETURNING id, account_number, balance
    `, accountValues);

    const accounts = accountsResult.rows;
    logger.info(`✅ Seeded ${accounts.length} accounts`);

    // ── 3. Create Transactions ─────────────────────────────────
    // Realistic transaction history for the past 6 months.
    const txns = [
      // Deposits
      { to: accounts[0].id, from: null, type: 'deposit',    amount: 50000, desc: 'Salary credit - January',       ref: 'TXN-20260101-00000001', daysAgo: 175 },
      { to: accounts[0].id, from: null, type: 'deposit',    amount: 50000, desc: 'Salary credit - February',      ref: 'TXN-20260201-00000002', daysAgo: 144 },
      { to: accounts[0].id, from: null, type: 'deposit',    amount: 52000, desc: 'Salary credit - March',         ref: 'TXN-20260301-00000003', daysAgo: 115 },
      { to: accounts[0].id, from: null, type: 'deposit',    amount: 52000, desc: 'Salary credit - April',         ref: 'TXN-20260401-00000004', daysAgo: 84 },
      { to: accounts[0].id, from: null, type: 'deposit',    amount: 55000, desc: 'Salary credit - May',           ref: 'TXN-20260501-00000005', daysAgo: 54 },
      { to: accounts[0].id, from: null, type: 'deposit',    amount: 55000, desc: 'Salary credit - June',          ref: 'TXN-20260601-00000006', daysAgo: 23 },
      { to: accounts[2].id, from: null, type: 'deposit',    amount: 40000, desc: 'Freelance payment',             ref: 'TXN-20260315-00000007', daysAgo: 101 },
      { to: accounts[3].id, from: null, type: 'deposit',    amount: 100000, desc: 'Business revenue Q1',          ref: 'TXN-20260401-00000008', daysAgo: 84 },

      // Withdrawals
      { from: accounts[0].id, to: null, type: 'withdrawal', amount: 5000,  desc: 'ATM withdrawal',               ref: 'TXN-20260115-00000009', daysAgo: 160 },
      { from: accounts[0].id, to: null, type: 'withdrawal', amount: 8000,  desc: 'Rent payment',                  ref: 'TXN-20260201-00000010', daysAgo: 144 },
      { from: accounts[1].id, to: null, type: 'withdrawal', amount: 3500,  desc: 'Shopping',                      ref: 'TXN-20260210-00000011', daysAgo: 135 },
      { from: accounts[2].id, to: null, type: 'withdrawal', amount: 12000, desc: 'Car EMI payment',               ref: 'TXN-20260305-00000012', daysAgo: 111 },
      { from: accounts[5].id, to: null, type: 'withdrawal', amount: 2500,  desc: 'Grocery shopping',              ref: 'TXN-20260420-00000013', daysAgo: 65 },

      // Transfers
      { from: accounts[0].id, to: accounts[2].id, type: 'transfer', amount: 15000, desc: 'Birthday gift to Priya',       ref: 'TXN-20260220-00000014', daysAgo: 124 },
      { from: accounts[3].id, to: accounts[0].id, type: 'transfer', amount: 7500,  desc: 'Dinner split from Arjun',      ref: 'TXN-20260310-00000015', daysAgo: 106 },
      { from: accounts[0].id, to: accounts[5].id, type: 'transfer', amount: 10000, desc: 'Rent share to Sneha',          ref: 'TXN-20260401-00000016', daysAgo: 84 },
      { from: accounts[4].id, to: accounts[3].id, type: 'transfer', amount: 25000, desc: 'Business to savings transfer', ref: 'TXN-20260415-00000017', daysAgo: 70 },
      { from: accounts[2].id, to: accounts[0].id, type: 'transfer', amount: 5000,  desc: 'Return payment to Rahul',      ref: 'TXN-20260501-00000018', daysAgo: 54 },
      { from: accounts[0].id, to: accounts[3].id, type: 'transfer', amount: 3000,  desc: 'Gift to Arjun',                ref: 'TXN-20260520-00000019', daysAgo: 35 },
      { from: accounts[5].id, to: accounts[2].id, type: 'transfer', amount: 8000,  desc: 'Payment to Priya',             ref: 'TXN-20260610-00000020', daysAgo: 14 },
    ];

    for (const txn of txns) {
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - txn.daysAgo);

      await client.query(`
        INSERT INTO transactions (from_account_id, to_account_id, type, amount, status, description, reference_number, ip_address, created_at)
        VALUES ($1, $2, $3, $4, 'completed', $5, $6, '192.168.1.1', $7)
      `, [txn.from || null, txn.to || null, txn.type, txn.amount, txn.desc, txn.ref, createdAt]);
    }

    logger.info(`✅ Seeded ${txns.length} transactions`);

    // ── 4. Create Loans ────────────────────────────────────────
    await client.query(`
      INSERT INTO loans (user_id, account_id, amount, interest_rate, term_months, monthly_payment, status, approved_by, approved_at)
      VALUES
        ($1, $2, 200000, 8.50, 24, 9114.63, 'active', $3, NOW() - INTERVAL '60 days'),
        ($4, $5, 500000, 9.25, 36, 15918.45, 'pending', NULL, NULL)
    `, [users[1].id, accounts[0].id, users[0].id, users[3].id, accounts[3].id]);

    logger.info('✅ Seeded 2 loans');

    // ── 5. Create Fraud Flags ──────────────────────────────────
    // Get a transaction ID to attach a fraud flag to
    const txnResult = await client.query(
      `SELECT id FROM transactions WHERE reference_number = 'TXN-20260415-00000017'`
    );
    const largeTxnId = txnResult.rows[0]?.id;

    if (largeTxnId) {
      await client.query(`
        INSERT INTO fraud_flags (transaction_id, user_id, flag_type, severity, description, metadata)
        VALUES
          ($1, $2, 'large_transaction', 'medium', 'Transaction amount ₹25,000 exceeds threshold', '{"amount": 25000, "threshold": 20000}'::jsonb),
          ($1, $2, 'velocity_check', 'low', 'User had 4 transactions in 10 minutes', '{"count": 4, "window_minutes": 10}'::jsonb)
      `, [largeTxnId, users[3].id]);

      logger.info('✅ Seeded 2 fraud flags');
    }

    // ── 6. Create Audit Logs ───────────────────────────────────
    for (const user of users) {
      await client.query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, ip_address)
        VALUES ($1, 'user.register', 'user', $1, $2, '192.168.1.1')
      `, [user.id, JSON.stringify({ email: user.email, role: user.role })]);
    }

    logger.info(`✅ Seeded ${users.length} audit logs`);

    await client.query('COMMIT');
    logger.info('🎉 All seed data inserted successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('❌ Seeding failed — rolled back', {
      error: error.message,
      detail: error.detail,
    });
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = seed;
