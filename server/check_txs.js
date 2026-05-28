import { query } from './src/config/db.js';

async function checkTxs() {
  try {
    const { rows } = await query(`
      SELECT reference, amount, status, type, created_at 
      FROM transactions 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    console.table(rows);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

checkTxs();
