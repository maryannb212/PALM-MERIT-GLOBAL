import * as dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const { rows } = await pool.query("SELECT id, status, note, created_at, payload->'data'->>'tx_ref' as tx_ref, payload->'data'->>'amount' as amount FROM webhook_logs ORDER BY created_at DESC LIMIT 5");
  console.log(rows);
  process.exit(0);
}
run();
