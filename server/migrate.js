import { query } from './src/config/db.js';

async function migrate() {
  try {
    console.log('Dropping constraint...');
    await query('ALTER TABLE savings_plans DROP CONSTRAINT IF EXISTS savings_plans_status_check');
    console.log('Adding constraint...');
    await query("ALTER TABLE savings_plans ADD CONSTRAINT savings_plans_status_check CHECK (status IN ('active', 'completed', 'cancelled', 'matured', 'pending_clearance', 'pending_settlement', 'settled', 'eligibility_review'))");
    console.log('Migration successful');
  } catch (err) {
    console.error('Migration failed:', err);
  }
  process.exit(0);
}

migrate();
