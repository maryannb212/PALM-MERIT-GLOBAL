import { query } from './src/config/db.js';

try {
  // Check transactions for the CREST plan
  const txs = await query(`
    SELECT type, amount, status, reference, created_at
    FROM transactions
    WHERE plan_id = 'b7b4fa48-ecb2-4712-ba2a-325c4f6a293e'
    ORDER BY created_at
  `);
  console.log('CREST plan transactions:', JSON.stringify(txs.rows, null, 2));

  // Also check what referral code the user entered by checking the plan's creation
  // Check if the user had wallet deductions
  const wallet = await query(`
    SELECT available_balance, wallet_balance FROM users WHERE id = '7d7ae80e-86a2-4438-b0ee-b2655ba28575'
  `);
  console.log('User wallet:', JSON.stringify(wallet.rows, null, 2));
} catch(e) {
  console.error('Error:', e.message);
}
process.exit(0);
