import { query } from './server/src/config/db.js';

(async () => {
  try {
    console.log('=== Checking if deduction cron has been running ===\n');
    
    const { rows: autosav } = await query(
      "SELECT t.id, t.plan_id, t.amount, t.reference, t.created_at, p.plan_name FROM transactions t JOIN savings_plans p ON t.plan_id = p.id WHERE t.reference LIKE 'AUTOSAV-%' ORDER BY t.created_at DESC LIMIT 10"
    );
    console.log('AUTOSAV transactions (deduction job):', JSON.stringify(autosav, null, 2));

    const { rows: skips } = await query(
      "SELECT t.id, t.plan_id, t.amount, t.reference, t.created_at, p.plan_name FROM transactions t JOIN savings_plans p ON t.plan_id = p.id WHERE t.reference LIKE 'SKIP-%' ORDER BY t.created_at DESC LIMIT 10"
    );
    console.log('\nSKIP markers:', JSON.stringify(skips, null, 2));

    const { rows: savings } = await query(
      "SELECT t.id, t.plan_id, t.amount, t.status, t.reference, t.created_at, p.plan_name, p.user_id FROM transactions t JOIN savings_plans p ON t.plan_id = p.id WHERE t.type = 'savings' ORDER BY t.created_at DESC LIMIT 15"
    );
    console.log('\nSAVINGS transactions:', JSON.stringify(savings, null, 2));

    const { rows: defaults } = await query(
      "SELECT d.id, d.plan_id, d.penalty_amount, d.amount_paid, d.missed_date, d.status, d.created_at, p.plan_name FROM defaults d JOIN savings_plans p ON d.plan_id = p.id ORDER BY d.created_at DESC LIMIT 15"
    );
    console.log('\nDEFAULTS:', JSON.stringify(defaults, null, 2));

    const { rows: settlements } = await query(
      "SELECT t.id, t.plan_id, t.amount, t.reference, t.created_at, p.plan_name FROM transactions t JOIN savings_plans p ON t.plan_id = p.id WHERE t.type = 'penalty_settlement' ORDER BY t.created_at DESC LIMIT 10"
    );
    console.log('\nSETTLEMENTS:', JSON.stringify(settlements, null, 2));

    const { rows: plans } = await query(
      "SELECT id, plan_name, user_id, status, current_amount, preferred_day, start_date FROM savings_plans ORDER BY id"
    );
    console.log('\nPLANS:', JSON.stringify(plans, null, 2));

    const { rows: users } = await query(
      "SELECT id, email, available_balance, wallet_balance FROM users ORDER BY id"
    );
    console.log('\nUSERS:', JSON.stringify(users, null, 2));

    process.exit(0);
  } catch(e) { 
    console.error('Error:', e); 
    process.exit(1); 
  }
})();
