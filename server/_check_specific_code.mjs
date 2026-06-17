import { query } from './src/config/db.js';

try {
  const r = await query(`
    SELECT rc.*, sp.plan_name as source_plan, sp.status as plan_status,
           u.email as owner_email
    FROM referral_codes rc
    LEFT JOIN savings_plans sp ON rc.plan_id = sp.id
    LEFT JOIN users u ON rc.user_id = u.id
    WHERE rc.code = 'PMG-SIL-19871'
  `);
  console.log('Code lookup:', JSON.stringify(r.rows, null, 2));

  // Also check if any plan was created referencing this code somehow
  // Check if there's a user who was referred
  const referred = await query(`
    SELECT id, email, first_name, last_name, referred_by 
    FROM users WHERE referred_by IS NOT NULL
    ORDER BY created_at DESC LIMIT 10
  `);
  console.log('Recently referred users:', JSON.stringify(referred.rows, null, 2));
} catch(e) {
  console.error('Error:', e.message);
}
process.exit(0);
