import { query } from './src/config/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const { rows } = await query("SELECT email, wallet_balance, available_balance, role FROM users WHERE available_balance > 0");
  console.log('Users with available balance:', rows);
  process.exit(0);
}
check();
