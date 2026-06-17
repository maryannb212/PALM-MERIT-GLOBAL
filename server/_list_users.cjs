const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  password: 'postgres',
  database: 'palm_merit',
  host: 'localhost',
  port: 5432,
});
pool.query("SELECT id, first_name, last_name, email, phone, role, available_balance, created_at FROM users ORDER BY id", (err, res) => {
  if (err) { console.error(err.message); pool.end(); return; }
  console.table(res.rows);
  pool.end();
});
