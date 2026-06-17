import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  user: 'postgres',
  password: 'postgres',
  database: 'palm_merit',
  host: 'localhost',
  port: 5432,
});
const res = await pool.query(
  "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position"
);
console.table(res.rows);
await pool.end();
