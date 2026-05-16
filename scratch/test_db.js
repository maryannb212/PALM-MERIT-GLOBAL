import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

console.log('Testing connection to:', process.env.DATABASE_URL);

try {
  const start = Date.now();
  const res = await pool.query('SELECT NOW()');
  console.log('Success! Database time:', res.rows[0].now);
  console.log('Latency:', Date.now() - start, 'ms');
  process.exit(0);
} catch (err) {
  console.error('Connection failed!');
  console.error(err);
  process.exit(1);
}
