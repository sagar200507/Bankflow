const pool = require('./src/config/database');
async function run() {
  const res = await pool.query("SELECT email, password_hash FROM users LIMIT 1");
  console.log(res.rows);
  pool.end();
}
run();
