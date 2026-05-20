import { query } from './src/config/db.js';

const migrate = async () => {
  try {
    console.log('Adding eligibility_approved column to savings_plans...');
    await query(`
      ALTER TABLE savings_plans 
      ADD COLUMN IF NOT EXISTS eligibility_approved BOOLEAN DEFAULT FALSE;
    `);
    console.log('Migration successful.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
};

migrate();
