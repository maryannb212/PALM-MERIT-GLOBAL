import { query } from './src/config/db.js';

async function updateFK() {
  try {
    // Drop existing constraints
    await query('ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey');
    await query('ALTER TABLE payouts DROP CONSTRAINT IF EXISTS payouts_user_id_fkey');
    await query('ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_admin_id_fkey');
    
    // Add cascading constraints
    await query('ALTER TABLE transactions ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE');
    await query('ALTER TABLE payouts ADD CONSTRAINT payouts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE');
    await query('ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE');

    console.log('Successfully updated constraints to CASCADE');
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

updateFK();
