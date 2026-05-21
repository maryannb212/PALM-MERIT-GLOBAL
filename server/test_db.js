import { query } from './src/config/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const { rows } = await query('SELECT id, email, wallet_balance, available_balance, held_balance FROM users LIMIT 10');
  console.log(rows);
  process.exit(0);
}
check();
