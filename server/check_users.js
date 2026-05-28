import { query } from './src/config/db.js';

async function verifyDeletedUser() {
  try {
    const { rows } = await query('SELECT id, first_name, last_name, status, email FROM users ORDER BY created_at DESC LIMIT 10');
    console.table(rows);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

verifyDeletedUser();
