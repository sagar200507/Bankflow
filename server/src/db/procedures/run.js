/**
 * ═══════════════════════════════════════════════════════════════
 *  Stored Procedure Runner
 * ═══════════════════════════════════════════════════════════════
 *
 * Installs all stored procedures and functions into PostgreSQL.
 * Unlike migrations, procedures can be re-run safely because
 * CREATE OR REPLACE overwrites the previous definition.
 *
 * Usage: npm run db:procedures
 * ═══════════════════════════════════════════════════════════════
 */
const fs = require('fs');
const path = require('path');
const pool = require('../../config/database');
const logger = require('../../utils/logger');

const PROCEDURE_FILES = [
  '001_transfer_funds.sql',
  '002_analytics_functions.sql',
  '003_fraud_functions.sql',
];

async function runProcedures() {
  const client = await pool.connect();

  try {
    for (const file of PROCEDURE_FILES) {
      const filePath = path.join(__dirname, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      logger.info(`Installing procedure: ${file}`);
      await client.query(sql);
      logger.info(`✅ Installed: ${file}`);
    }

    logger.info('🎉 All stored procedures installed successfully');
  } catch (error) {
    logger.error('❌ Procedure installation failed', {
      error: error.message,
      detail: error.detail,
    });
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runProcedures()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = runProcedures;
