import { query } from './src/config/db.js';

async function checkBankNames() {
  try {
    const { rows } = await query(`
      SELECT virtual_bank_name, virtual_provider, COUNT(*) 
      FROM users
      WHERE virtual_account_number IS NOT NULL
      GROUP BY virtual_bank_name, virtual_provider
    `);
    console.table(rows);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

checkBankNames();
