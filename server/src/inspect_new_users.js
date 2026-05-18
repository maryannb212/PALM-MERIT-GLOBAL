import pool from './config/db.js';

async function inspectNew() {
  try {
    console.log('--- RECENT USERS ---');
    const { rows: users } = await pool.query('SELECT id, first_name, last_name, email, phone, role, has_paid_membership, kyc_status, created_at FROM users ORDER BY created_at DESC LIMIT 10;');
    console.log(users);

    console.log('\n--- RECENT TRANSACTIONS ---');
    const { rows: txs } = await pool.query('SELECT id, user_id, amount, type, status, reference, created_at FROM transactions ORDER BY created_at DESC LIMIT 10;');
    console.log(txs);
    
    pool.end();
  } catch (err) {
    console.error('Error running diagnostics:', err);
    process.exit(1);
  }
}

inspectNew();
