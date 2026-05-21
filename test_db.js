import { query } from './server/src/config/db.js';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

async function check() {
  const { rows } = await query('SELECT id, email, wallet_balance, available_balance, held_balance FROM users LIMIT 10');
  console.log(rows);
  process.exit(0);
}
check();
