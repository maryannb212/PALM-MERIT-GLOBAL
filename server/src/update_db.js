import pool from './config/db.js';

async function run() {
  try {
    await pool.query('ALTER TABLE savings_plans ADD COLUMN number_of_accounts INTEGER DEFAULT 1;');
    console.log('Added number_of_accounts to savings_plans.');
  } catch (err) {
    if (err.code === '42701') {
      console.log('Column number_of_accounts already exists.');
    } else {
      console.error(err);
    }
  } finally {
    process.exit(0);
  }
}
run();
