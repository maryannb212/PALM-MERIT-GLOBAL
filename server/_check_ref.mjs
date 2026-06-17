import { query } from './src/config/db.js';

try {
  // Check referral codes and their usage
  const codes = await query(`
    SELECT rc.id, rc.code, rc.status, rc.user_id, rc.used_by_user_id, rc.plan_id, 
           sp.plan_name, sp.user_id as plan_owner_id
    FROM referral_codes rc
    LEFT JOIN savings_plans sp ON rc.plan_id = sp.id
    ORDER BY rc.created_at DESC
    LIMIT 30
  `);
  console.log('Recent referral codes:', JSON.stringify(codes.rows, null, 2));

  // Count stats
  const stats = await query(`
    SELECT status, COUNT(*) FROM referral_codes GROUP BY status
  `);
  console.log('Status stats:', JSON.stringify(stats.rows, null, 2));

  // Check for any codes where status should be 'used' but isn't
  const suspicious = await query(`
    SELECT rc.* FROM referral_codes rc
    JOIN savings_plans sp ON sp.id = rc.plan_id
    WHERE rc.status = 'used' AND sp.status = 'cancelled'
  `);
  console.log('Used codes on cancelled plans:', suspicious.rowCount);
} catch(e) {
  console.error('Error:', e.message);
}
process.exit(0);
