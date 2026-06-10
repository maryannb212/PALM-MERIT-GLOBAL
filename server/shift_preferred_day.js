import { getClient } from './src/config/db.js';

const runMigration = async () => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    
    console.log('Shifting preferred_day backwards by 1 day for all active savings_plans...');
    
    const result = await client.query(`
      UPDATE savings_plans
      SET preferred_day = CASE
        WHEN preferred_day = 'Sunday' THEN 'Saturday'
        WHEN preferred_day = 'Monday' THEN 'Sunday'
        WHEN preferred_day = 'Tuesday' THEN 'Monday'
        WHEN preferred_day = 'Wednesday' THEN 'Tuesday'
        WHEN preferred_day = 'Thursday' THEN 'Wednesday'
        WHEN preferred_day = 'Friday' THEN 'Thursday'
        WHEN preferred_day = 'Saturday' THEN 'Friday'
        ELSE preferred_day
      END
      WHERE status = 'active';
    `);

    console.log(`Successfully updated ${result.rowCount} active savings plans.`);
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
  } finally {
    client.release();
    process.exit(0);
  }
};

runMigration();
