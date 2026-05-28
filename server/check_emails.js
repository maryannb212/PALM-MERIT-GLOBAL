import { query } from './src/config/db.js';

async function checkEmails() {
  try {
    const { rows } = await query(`
      SELECT COUNT(*) as count, 
             (email IS NULL) as is_null_email,
             (virtual_account_number IS NOT NULL) as has_va
      FROM users
      GROUP BY (email IS NULL), (virtual_account_number IS NOT NULL)
    `);
    console.table(rows);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

checkEmails();
