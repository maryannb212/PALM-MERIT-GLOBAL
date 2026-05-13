import cron from 'node-cron';
import { query } from '../config/db.js';
import logger from '../utils/logger.js';

export const runStaffDeactivation = async () => {
  logger.info('[Job] Running Staff Deactivation...');
  try {
    // Deactivate staff or admin who haven't logged in for 48 hours
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
        logger.info(`[Cron] Deactivated ${rows.length} inactive staff/admin accounts.`);
        rows.forEach(user => {
          logger.info(`- Deactivated: ${user.email} (${user.role})`);
        });
      }

      return { success: true, deactivatedCount: rows.length };
    } catch (error) {
      logger.error('[Job] Error in Staff Deactivation Job:', error);
      throw error;
    }
};

export const startStaffDeactivationJob = () => {
  // Run every hour to check for inactive staff
  cron.schedule('0 * * * *', async () => {
    try {
      await runStaffDeactivation();
    } catch (error) {
      logger.error('[Cron] Error in Staff Deactivation execution:', error);
    }
  });
};
