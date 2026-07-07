/**
 * ═══════════════════════════════════════════════════════════════
 *  BankFlow — Database Migration Runner
 * ═══════════════════════════════════════════════════════════════
 *
 * Executes all migration SQL files in sequence.
 * Migrations are idempotent (uses IF NOT EXISTS) so they can
 * be re-run safely without data loss.
 *
 * Usage: npm run db:migrate
 *
 * Migration order matters — foreign keys require parent tables
 * to exist first, hence the numbered prefix convention:
 *   001_extensions.sql  → UUID generation
 *   002_users.sql       → No FK dependencies
 *   003_accounts.sql    → FK → users
 *   004_transactions.sql→ FK → accounts
 *   005_loans.sql       → FK → users, accounts
 *   006_fraud_flags.sql → FK → transactions, users
 *   007_audit_logs.sql  → FK → users
 *   008_indexes.sql     → Indexes on all tables
 */
const fs = require('fs');
const path = require('path');
const pool = require('../../config/database');
const logger = require('../../utils/logger');

const MIGRATION_FILES = [
  '001_extensions.sql',
  '002_users.sql',
  '003_accounts.sql',
  '004_transactions.sql',
  '005_loans.sql',
  '006_fraud_flags.sql',
  '007_audit_logs.sql',
  '008_indexes.sql',
  '009_fraud_explanations.sql',
  '010_ledger_entries.sql',
];

async function runMigrations() {
  const client = await pool.connect();

  try {
    // Wrap ALL migrations in a single transaction.
    // If any migration fails, the entire batch rolls back —
    // this prevents a half-migrated database.
    await client.query('BEGIN');

    for (const file of MIGRATION_FILES) {
      const filePath = path.join(__dirname, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      logger.info(`Running migration: ${file}`);
      await client.query(sql);
      logger.info(`✅ Completed: ${file}`);
    }

    await client.query('COMMIT');
    logger.info('🎉 All migrations completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('❌ Migration failed — rolled back', {
      error: error.message,
      detail: error.detail,
    });
    throw error;
  } finally {
    client.release();
  }
}

// Execute if run directly (not imported)
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = runMigrations;
