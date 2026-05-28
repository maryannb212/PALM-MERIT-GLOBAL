import cron from 'node-cron';
import { query } from '../config/db.js';
import { applyDailyInterest } from '../services/interestEngine.js';
import { createNotification } from '../models/notificationModel.js';

// Plan rates configuration
const PLAN_CONFIG = {
  'CREST': { weekly: 4000, penalty: 500 },
  'SILVER': { weekly: 1500, penalty: 200 },
  'GOLDEN_BASKET': { weekly: 2000, penalty: 300 },
  'ISUSU': { daily: 500, penalty: 50 }
};

/**
 * Count how many contribution days have occurred between a start date and today.
 * - For weekly plans: counts how many times the preferred_day has occurred since start_date.
 * - For daily plans (ISUSU): counts the number of calendar days elapsed.
 */
const countExpectedContributions = (startDate, preferredDay, isDaily) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  if (start >= today) return 0;

  if (isDaily) {
    const diffTime = today - start;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  // Weekly: count occurrences of preferredDay since start_date
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDayIndex = daysOfWeek.findIndex(d => d.toLowerCase() === (preferredDay || '').toLowerCase());

  if (targetDayIndex === -1) {
    // Fallback: if no preferred_day is set, use simple week count
    const diffTime = today - start;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
  }

  let count = 0;
  const cursor = new Date(start);

  // Move cursor to the first occurrence of the target day on or after start
  while (cursor.getDay() !== targetDayIndex) {
    cursor.setDate(cursor.getDate() + 1);
  }

  // Count each occurrence up to (but not including) today
  while (cursor < today) {
    count++;
    cursor.setDate(cursor.getDate() + 7);
  }

  return count;
};

export const runPenaltyCheck = async () => {
  console.log('Running penalty check job...');
  try {
    // Find all active savings plans
    const sql = `SELECT * FROM savings_plans WHERE status = 'active'`;
    const { rows: activePlans } = await query(sql);

    for (const plan of activePlans) {
      const config = PLAN_CONFIG[plan.plan_name];
      if (!config) continue;

      const isDaily = !!config.daily;
      const contributionAmount = config.weekly || config.daily;
      const accounts = plan.number_of_accounts || 1;

      // Calculate expected amount based on actual contribution days
      const expectedContributions = countExpectedContributions(
        plan.start_date,
        plan.preferred_day,
        isDaily
      );

      // Expected total = contributions × per-contribution amount × number of accounts
      // We add the initial savings (first contribution) which is already recorded at plan creation
      const expectedAmount = expectedContributions * contributionAmount * accounts;

      // If the current amount is less than expected, it's a default
      if (parseFloat(plan.current_amount) < expectedAmount) {
        const penaltyAmount = config.penalty;

        // Check if we already recorded a default for today
        const checkDefaultSql = `
          SELECT * FROM defaults
          WHERE plan_id = $1 AND missed_date = CURRENT_DATE
        `;
        const existingDefault = await query(checkDefaultSql, [plan.id]);

        if (existingDefault.rows.length === 0) {
          console.log(`Applying penalty of ${penaltyAmount} to plan ${plan.id} (${plan.plan_name}) - Expected: ${expectedAmount}, Actual: ${plan.current_amount}`);

          // Record default
          await query(`
            INSERT INTO defaults (user_id, plan_id, missed_date, penalty_amount)
            VALUES ($1, $2, CURRENT_DATE, $3)
          `, [plan.user_id, plan.id, penaltyAmount]);

          // Create penalty transaction
          await query(`
            INSERT INTO transactions (user_id, plan_id, type, amount, status, reference)
            VALUES ($1, $2, 'penalty', $3, 'completed', $4)
          `, [plan.user_id, plan.id, penaltyAmount, `PEN-${Date.now()}`]);

          // Send a notification
          await createNotification(
            plan.user_id,
            'ALERT',
            'Penalty Applied',
            `A penalty of ₦${penaltyAmount.toLocaleString()} has been applied to your ${plan.plan_name} plan due to missed contributions. (Expected: ₦${expectedAmount.toLocaleString()}, Current: ₦${parseFloat(plan.current_amount).toLocaleString()})`
          );
        }
      }
    }
    return { success: true, message: 'Penalty check completed' };
  } catch (error) {
    console.error('Error running penalty job:', error);
    throw error;
  }
};

export const startCronJobs = () => {
  // Run daily at midnight (0 0 * * *)
  cron.schedule('0 0 * * *', async () => {
    console.log('--- Starting Daily Scheduled Tasks ---');

    // 1. Apply Daily Interest
    try {
      await applyDailyInterest();
    } catch (error) {
      console.error('Error applying interest:', error);
    }

    // 2. Penalty Checks
    try {
      await runPenaltyCheck();
    } catch (error) {
      console.error('Error in penalty cron execution:', error);
    }
  });
};
