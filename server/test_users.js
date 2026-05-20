import { query } from './src/config/db.js';

async function test() {
  try {
    const { rows } = await query('SELECT id, first_name, last_name, email, phone, role, created_at FROM users ORDER BY created_at DESC LIMIT 5;');
    console.log(rows);
  } catch (error) {
    console.error(error);
  } finally {
    process.exit(0);
  }
}
test();
