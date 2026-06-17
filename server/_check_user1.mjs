import { query } from './src/config/db.js';

try {
  // Check user1's details
  const user = await query(`SELECT id, email, first_name, last_name FROM users WHERE email = 'user@gmail.com'`);
  console.log('User:', JSON.stringify(user.rows, null, 2));
  const uid = user.rows[0]?.id;
  if (!uid) { console.log('User not found'); process.exit(0); }

  // Their plans - most recent first
  const plans = await query(`
    SELECT id, plan_name, number_of_accounts, start_date, created_at, end_date, maturity_date, status
    FROM savings_plans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5
  `, [uid]);
  console.log('Latest plans:', JSON.stringify(plans.rows, null, 2));

  // Their referral codes
  const codes = await query(`
    SELECT code, status, used_by_user_id FROM referral_codes WHERE user_id = $1 ORDER BY created_at DESC
  `, [uid]);
  console.log('Their codes:', JSON.stringify(codes.rows, null, 2));

  // Check who referred them
  const referred = await query(`SELECT referred_by FROM users WHERE id = $1`, [uid]);
  console.log('Referred by:', referred.rows[0]?.referred_by);

  // All users with referred_by pointing to this user
  const referrals = await query(`SELECT id, email, first_name FROM users WHERE referred_by = $1`, [uid]);
  console.log('Users they referred:', JSON.stringify(referrals.rows, null, 2));
} catch(e) {
  console.error('Error:', e.message);
}
process.exit(0);
