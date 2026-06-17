import { query } from './src/config/db.js';

try {
  // Check all plans for user 7d7ae80e
  const plans = await query(`
    SELECT id, plan_name, number_of_accounts, status, created_at, end_date
    FROM savings_plans
    WHERE user_id = '7d7ae80e-86a2-4438-b0ee-b2655ba28575'
    ORDER BY created_at DESC
  `);
  console.log('user@gmail.com plans:', JSON.stringify(plans.rows, null, 2));

  // Check all referrals where this user was the referrer
  const asReferrer = await query(`
    SELECT u.id, u.email, u.first_name, u.last_name, u.referred_by
    FROM users u
    WHERE u.referred_by = '7d7ae80e-86a2-4438-b0ee-b2655ba28575'
  `);
  console.log('Users referred by user@gmail.com:', JSON.stringify(asReferrer.rows, null, 2));

  // Check their referral codes
  const codes = await query(`
    SELECT code, status, used_by_user_id, plan_id FROM referral_codes
    WHERE user_id = '7d7ae80e-86a2-4438-b0ee-b2655ba28575'
    ORDER BY created_at DESC
  `);
  console.log('Their referral codes:', JSON.stringify(codes.rows, null, 2));
} catch(e) {
  console.error('Error:', e.message);
}
process.exit(0);
