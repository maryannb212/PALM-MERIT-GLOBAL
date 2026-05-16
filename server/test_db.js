import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

console.log('Testing connection to host:', process.env.DATABASE_URL?.split('@')[1]?.split('/')[0]);

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
