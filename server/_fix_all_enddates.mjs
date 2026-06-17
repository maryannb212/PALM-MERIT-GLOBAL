import { query } from './src/config/db.js';

try {
  const before = await query(`SELECT COUNT(*) FROM savings_plans WHERE end_date IS NULL`);
  console.log('Before:', before.rows[0].count);

  const result = await query(`
    UPDATE savings_plans
    SET 
      end_date = 
        CASE plan_name
          WHEN 'CREST' THEN (COALESCE(start_date, created_at) + INTERVAL '84 days')::timestamptz
          WHEN 'SILVER' THEN (COALESCE(start_date, created_at) + INTERVAL '350 days')::timestamptz
          WHEN 'GOLDEN_BASKET' THEN (COALESCE(start_date, created_at) + INTERVAL '350 days')::timestamptz
          WHEN 'ISUSU' THEN (COALESCE(start_date, created_at) + INTERVAL '30 days')::timestamptz
        END,
      maturity_date = 
        CASE plan_name
          WHEN 'CREST' THEN (COALESCE(start_date, created_at) + INTERVAL '84 days')::timestamptz
          WHEN 'SILVER' THEN (COALESCE(start_date, created_at) + INTERVAL '350 days')::timestamptz
          WHEN 'GOLDEN_BASKET' THEN (COALESCE(start_date, created_at) + INTERVAL '350 days')::timestamptz
          WHEN 'ISUSU' THEN (COALESCE(start_date, created_at) + INTERVAL '30 days')::timestamptz
        END
    WHERE end_date IS NULL
  `);
  console.log('Updated rows:', result.rowCount);

  const after = await query(`SELECT COUNT(*) FROM savings_plans WHERE end_date IS NULL`);
  console.log('After:', after.rows[0].count);
  
  // Show a sample of the updated records
  const sample = await query(`
    SELECT id, plan_name, start_date, end_date, created_at 
    FROM savings_plans 
    WHERE end_date IS NOT NULL 
    ORDER BY created_at DESC 
    LIMIT 5
  `);
  console.log('Sample updated:', JSON.stringify(sample.rows, null, 2));
} catch(e) {
  console.error('Error:', e.message);
}
process.exit(0);
