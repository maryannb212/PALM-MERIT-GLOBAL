import { query } from './src/config/db.js';

async function checkSystemFallback() {
  try {
    const { rows } = await query(`
      SELECT id, email, first_name, last_name, phone
      FROM users
      WHERE virtual_provider = 'system_fallback'
    `);
    console.table(rows);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

checkSystemFallback();
