import { query } from './src/config/db.js';

try {
  // Check users table for referral_code column
  const cols = await query(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name LIKE '%referral%'
  `);
  console.log('User referral columns:', JSON.stringify(cols.rows, null, 2));

  // Check a sample user to see their referral_code
  const users = await query(`
    SELECT id, first_name, last_name, email, referral_code, referred_by 
    FROM users 
    WHERE referral_code IS NOT NULL 
    LIMIT 5
  `);
  console.log('Sample users with referral_code:', JSON.stringify(users.rows, null, 2));

  // See used referral codes with details
  const used = await query(`
    SELECT rc.id, rc.code, rc.status, rc.user_id as owner_id, 
           rc.used_by_user_id, u.email as used_by_email,
           sp.plan_name as source_plan
    FROM referral_codes rc
    LEFT JOIN users u ON rc.used_by_user_id = u.id
    LEFT JOIN savings_plans sp ON rc.plan_id = sp.id
    WHERE rc.status = 'used'
    ORDER BY rc.updated_at DESC
  `);
  console.log('Used codes:', JSON.stringify(used.rows, null, 2));
} catch(e) {
  console.error('Error:', e.message);
}
process.exit(0);
