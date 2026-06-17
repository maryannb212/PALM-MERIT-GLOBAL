import { query } from './src/config/db.js';

try {
  const r = await query(`
    SELECT id, user_id, plan_name, number_of_accounts, target_amount, start_date, created_at, end_date, maturity_date, status
    FROM savings_plans
    WHERE end_date IS NULL
    ORDER BY created_at DESC
  `);
  console.log('Plans with NULL end_date:', JSON.stringify(r.rows, null, 2));
} catch(e) {
  console.error('Error:', e.message);
}
process.exit(0);
