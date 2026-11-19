import cron from 'node-cron';
import { query } from '../config/db.js';
import logger from '../utils/logger.js';

export const runReferralCodeNotificationJob = async () => {
  await query(
    `UPDATE referral_codes
     SET status = 'available', updated_at = CURRENT_TIMESTAMP
     WHERE status = 'locked'
       AND unlock_date IS NOT NULL
       AND unlock_date <= CURRENT_TIMESTAMP`
  );

  await query(
    `UPDATE referral_codes
     SET status = 'expired', updated_at = CURRENT_TIMESTAMP
     WHERE status IN ('available', 'locked')
       AND used_by_user_id IS NULL
       AND expires_at IS NOT NULL
       AND expires_at <= CURRENT_TIMESTAMP`
  );

  const { rowCount } = await query(
    `WITH local_day AS (
       SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')::date AS today
     ),
     referral_events AS (
       SELECT
         rc.user_id,
         'SYSTEM' AS type,
         'Referral link unlocked' AS title,
         'Your referral link ' || rc.code || ' is now unlocked. It expires on ' ||
           COALESCE(to_char(rc.expires_at AT TIME ZONE 'Africa/Lagos', 'FMMonth DD, YYYY'), 'the scheduled expiry date') || '.' AS message,
         'referral-code:' || rc.id::text || ':unlock:' ||
           to_char(rc.unlock_date AT TIME ZONE 'Africa/Lagos', 'YYYY-MM-DD') AS event_key
       FROM referral_codes rc
       CROSS JOIN local_day
       WHERE rc.used_by_user_id IS NULL
         AND rc.unlock_date IS NOT NULL
         AND (rc.status = 'locked' OR rc.unlock_date > rc.created_at + INTERVAL '1 minute')
         AND (rc.unlock_date AT TIME ZONE 'Africa/Lagos')::date = local_day.today

       UNION ALL

       SELECT
         rc.user_id,
         'SYSTEM' AS type,
         'Referral link expires today' AS title,
         'Your referral link ' || rc.code || ' expires today. Use it before it expires.' AS message,
         'referral-code:' || rc.id::text || ':expiry:' ||
           to_char(rc.expires_at AT TIME ZONE 'Africa/Lagos', 'YYYY-MM-DD') AS event_key
       FROM referral_codes rc
       CROSS JOIN local_day
       WHERE rc.used_by_user_id IS NULL
         AND rc.expires_at IS NOT NULL
         AND (rc.expires_at AT TIME ZONE 'Africa/Lagos')::date = local_day.today
     )
     INSERT INTO notifications (user_id, type, title, message, event_key)
     SELECT user_id, type, title, message, event_key
     FROM referral_events
     ON CONFLICT (event_key) DO NOTHING`
  );

  logger.info(`Referral code lifecycle notifications created: ${rowCount || 0}`);
  return { notifications: rowCount || 0 };
};

export const startReferralCodeNotificationJob = () => {
  const runAndLog = async () => {
    try {
      await runReferralCodeNotificationJob();
    } catch (error) {
      logger.error('Error running referral code notification job:', error);
    }
  };

  cron.schedule('5 0 * * *', runAndLog, { timezone: 'Africa/Lagos' });
  void runAndLog();
};
