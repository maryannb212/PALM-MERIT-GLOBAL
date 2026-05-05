import cron from 'node-cron';
import { query } from '../config/db.js';

export const startStaffDeactivationJob = () => {
  // Run every hour to check for inactive staff
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Running Staff Deactivation Job...');
    try {
      // Deactivate staff or admin who haven't logged in for 48 hours
      // Assumes roles are 'admin' or 'staff'. The CEO might be excluded if we add a flag, but this meets the request.
      const sql = `
        UPDATE users
        SET status = 'deactivated', updated_at = CURRENT_TIMESTAMP
        WHERE role IN ('admin', 'staff')
        AND status = 'active'
        AND last_login < NOW() - INTERVAL '48 hours'
        RETURNING id, email, role;
      `;
      
      const { rows } = await query(sql);
      
      if (rows.length > 0) {
        console.log(`[Cron] Deactivated ${rows.length} inactive staff/admin accounts.`);
        rows.forEach(user => {
          console.log(`- Deactivated: ${user.email} (${user.role})`);
        });
      }
    } catch (error) {
      console.error('[Cron] Error in Staff Deactivation Job:', error);
    }
  });
};
