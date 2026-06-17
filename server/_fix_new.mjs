import { getClient } from './src/config/db.js';

try {
  const client = await getClient();

  // Fix end_date for the CREST plan (2 accounts, 84 days)
  const r1 = await client.query(`
    UPDATE savings_plans SET 
      end_date = (COALESCE(start_date, created_at) + INTERVAL '84 days')::timestamptz,
      maturity_date = (COALESCE(start_date, created_at) + INTERVAL '84 days')::timestamptz
    WHERE id = '6fe613ef-9a53-456a-a491-f938f7610c27' AND end_date IS NULL
    RETURNING id, plan_name, start_date, end_date
  `);
  console.log('CREST:', r1.rows[0]);

  // Fix end_date for the SILVER plan (1 account, 350 days)
  const r2 = await client.query(`
    UPDATE savings_plans SET 
      end_date = (COALESCE(start_date, created_at) + INTERVAL '350 days')::timestamptz,
      maturity_date = (COALESCE(start_date, created_at) + INTERVAL '350 days')::timestamptz
    WHERE id = '6e20ee20-48f7-446d-beee-0ac1a4df6a4d' AND end_date IS NULL
    RETURNING id, plan_name, start_date, end_date
  `);
  console.log('SILVER:', r2.rows[0]);

  // Mark PMG-SIL-19871 as used by this user
  const r3 = await client.query(`
    UPDATE referral_codes 
    SET status = 'used', used_by_user_id = '7d7ae80e-86a2-4438-b0ee-b2655ba28575', updated_at = NOW()
    WHERE code = 'PMG-SIL-19871' AND status = 'available'
    RETURNING code, status, used_by_user_id
  `);
  console.log('Referral code:', r3.rows[0]);

  client.release();
} catch(e) {
  console.error('Error:', e.message);
}
process.exit(0);
