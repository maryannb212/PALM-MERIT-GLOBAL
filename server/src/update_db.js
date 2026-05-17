import pool from './config/db.js';

async function run() {
  try {
    await pool.query('ALTER TABLE savings_plans ADD COLUMN preferred_day VARCHAR(20) DEFAULT NULL;');
    console.log('Added preferred_day to savings_plans.');
  } catch (err) {
    if (err.code === '42701') {
      console.log('Column preferred_day already exists.');
    } else {
      console.error(err);
    }
  } finally {
    process.exit(0);
  }
}
run();
