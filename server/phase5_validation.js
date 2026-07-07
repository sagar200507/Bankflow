const pool = require('./src/config/database');

async function runValidations() {
  console.log('--- STARTING PHASE 5 VALIDATION ---');
  
  // 1. Database Validation
  console.log('\n[1] Database Validation');
  let orphans = await pool.query(`SELECT COUNT(*) FROM ledger_entries WHERE transaction_id NOT IN (SELECT id FROM transactions)`);
  console.log(`Orphan Ledger Entries (should be 0): ${orphans.rows[0].count}`);

  let missingTxns = await pool.query(`
    SELECT COUNT(*) FROM transactions t 
    WHERE NOT EXISTS (SELECT 1 FROM ledger_entries le WHERE le.transaction_id = t.id)
  `);
  console.log(`Transactions missing ledger entries (should be 0): ${missingTxns.rows[0].count}`);

  // 2. Balance Validation
  console.log('\n[2] Balance Validation');
  const balanceMismatch = await pool.query(`
    WITH ledger_sums AS (
      SELECT account_id, 
             SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE -amount END) as net_change
      FROM ledger_entries
      GROUP BY account_id
    )
    SELECT a.id, a.account_number, a.balance, ls.net_change
    FROM accounts a
    JOIN ledger_sums ls ON a.id = ls.account_id
    WHERE a.balance != ls.net_change
  `);
  if (balanceMismatch.rows.length === 0) {
    console.log('All account balances perfectly match the sum of their ledger entries.');
  } else {
    console.log('MISMATCHES FOUND:');
    console.table(balanceMismatch.rows);
  }

  // 3. Performance / EXPLAIN ANALYZE
  console.log('\n[3] Performance (EXPLAIN ANALYZE for findByAccountId)');
  const explain = await pool.query(`
    EXPLAIN ANALYZE 
    SELECT le.transaction_id, le.entry_type, le.amount
    FROM ledger_entries le
    JOIN transactions t ON le.transaction_id = t.id
    WHERE le.account_id = (SELECT id FROM accounts LIMIT 1)
    ORDER BY le.created_at DESC
    LIMIT 15 OFFSET 0
  `);
  explain.rows.forEach(r => console.log(r['QUERY PLAN']));
  
  await pool.end();
  console.log('\n--- VALIDATION COMPLETE ---');
}

runValidations().catch(console.error);
