import { query } from './src/config/db.js';

try {
  const r = await query(`
    SELECT id, plan_name, number_of_accounts, start_date, created_at, end_date, status
    FROM savings_plans
    WHERE end_date IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 20
  `);
  console.log('Plans WITH end_date:', JSON.stringify(r.rows, null, 2));
  console.log('Count with end_date:', r.rows.length);
  
  const r2 = await query(`
    SELECT COUNT(*) as total, 
      SUM(CASE WHEN end_date IS NULL THEN 1 ELSE 0 END) as null_end,
      SUM(CASE WHEN end_date IS NOT NULL THEN 1 ELSE 0 END) as has_end
    FROM savings_plans
  `);
  console.log('Summary:', JSON.stringify(r2.rows, null, 2));
} catch(e) {
  console.error('Error:', e.message);
}
process.exit(0);
