const pool = require('./src/config/database');
async function run() {
  const { rows } = await pool.query("SELECT id, email FROM users");
  console.log("Users:", rows);
  
  for (const user of rows) {
    const tx = await pool.query("SELECT COUNT(*) FROM transactions WHERE from_account_id IN (SELECT id FROM accounts WHERE user_id = $1) OR to_account_id IN (SELECT id FROM accounts WHERE user_id = $1)", [user.id]);
    console.log(`User ${user.email} transactions:`, tx.rows[0].count);
  }
  pool.end();
}
run();
