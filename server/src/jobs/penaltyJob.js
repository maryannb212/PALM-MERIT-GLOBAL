import cron from 'node-cron';
import { query } from '../config/db.js';
import { applyDailyInterest } from '../services/interestEngine.js';
import { createNotification } from '../models/notificationModel.js';

const PLAN_CONFIG = {
  'CREST': { weekly: 4000, penalty: 8000 },
  'SILVER': { weekly: 1500, penalty: 3000 },
  'GOLDEN_BASKET': { weekly: 2000, penalty: 4000 },
  'ISUSU': { daily: 500, penalty: 1000 }
};

export const runPenaltyCheck = async () => {
  console.log('Running penalty check job...');
  try {
    const { rows: activePlans } = await query("SELECT * FROM savings_plans WHERE status = 'active'");

    for (const plan of activePlans) {
      const config = PLAN_CONFIG[plan.plan_name];
      if (!config) continue;

      const isDaily = !!config.daily;
      const expectedInstallment = (config.weekly || config.daily) * (plan.number_of_accounts || 1);
      const penaltyAmount = config.penalty;

      const { rows: todaySavings } = await query(`
        SELECT id FROM transactions
        WHERE plan_id = $1 AND type = 'savings' AND status = 'completed'
          AND created_at >= CURRENT_DATE LIMIT 1
      `, [plan.id]);

      const { rows: todayDefault } = await query(`
        SELECT id FROM defaults
        WHERE plan_id = $1 AND missed_date = CURRENT_DATE LIMIT 1
      `, [plan.id]);

      if (todaySavings.length > 0 || todayDefault.length > 0) continue;

      const { rows: lastTx } = await query(`
        SELECT created_at FROM transactions
        WHERE plan_id = $1 AND type = 'savings' AND status = 'completed'
        ORDER BY created_at DESC LIMIT 1
      `, [plan.id]);

      let isDue = false;

      if (isDaily) {
        isDue = true;
      } else {
        const todayDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

        if (lastTx.length === 0) {
          if (plan.preferred_day && plan.preferred_day.trim().toLowerCase() === todayDayName.toLowerCase()) {
            isDue = true;
          } else {
            const daysSinceStart = Math.floor((new Date() - new Date(plan.start_date)) / (1000 * 60 * 60 * 24));
            if (daysSinceStart >= 7) isDue = true;
          }
        } else {
          const daysSinceLast = Math.floor((new Date() - new Date(lastTx[0].created_at)) / (1000 * 60 * 60 * 24));
          if (daysSinceLast >= 7) isDue = true;
        }
      }

      if (!isDue) continue;

      const { rows: users } = await query('SELECT available_balance FROM users WHERE id = $1', [plan.user_id]);
      if (users.length === 0) continue;

      if (parseFloat(users[0].available_balance) >= expectedInstallment) {
        const ref = `AUTOSAV-PEN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        await query('UPDATE users SET available_balance = available_balance - $1, wallet_balance = wallet_balance - $1 WHERE id = $2', [expectedInstallment, plan.user_id]);
        await query('UPDATE savings_plans SET current_amount = current_amount + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [expectedInstallment, plan.id]);
        await query(`
          INSERT INTO transactions (user_id, plan_id, type, amount, status, reference)
          VALUES ($1, $2, 'savings', $3, 'completed', $4)
        `, [plan.user_id, plan.id, expectedInstallment, ref]);
        console.log(`Penalty job: caught-up deduction of N${expectedInstallment} for plan ${plan.id} (${plan.plan_name})`);
        continue;
      }

      console.log(`Applying default of N${penaltyAmount} to plan ${plan.id} (${plan.plan_name})`);

      const failedRef = `AUTOSAV-${Date.now()}`;
      const penRef = `PEN-${Date.now()}`;

      await query(`
        INSERT INTO defaults (user_id, plan_id, missed_date, penalty_amount)
        VALUES ($1, $2, CURRENT_DATE, $3)
      `, [plan.user_id, plan.id, penaltyAmount]);

      await query(`
        INSERT INTO transactions (user_id, plan_id, type, amount, status, reference)
        VALUES ($1, $2, 'savings', $3, 'failed', $4)
      `, [plan.user_id, plan.id, expectedInstallment, failedRef]);

      await query(`
        INSERT INTO transactions (user_id, plan_id, type, amount, status, reference)
        VALUES ($1, $2, 'penalty', $3, 'completed', $4)
      `, [plan.user_id, plan.id, penaltyAmount, penRef]);

      await createNotification(
        plan.user_id, 'ALERT', 'Default Charge Applied',
        `Your savings deduction of N${expectedInstallment.toLocaleString()} for ${plan.plan_name} failed due to insufficient funds. A default charge of N${penaltyAmount.toLocaleString()} has been applied. Please fund your wallet.`
      );
    }
    return { success: true, message: 'Penalty check completed' };
  } catch (error) {
    console.error('Error running penalty job:', error);
    throw error;
  }
};

export const startCronJobs = () => {
  cron.schedule('0 0 * * *', async () => {
    console.log('--- Starting Daily Scheduled Tasks ---');
    try {
      await applyDailyInterest();
    } catch (error) {
      console.error('Error applying interest:', error);
    }
    try {
      await runPenaltyCheck();
    } catch (error) {
      console.error('Error in penalty cron execution:', error);
    }
  });
};
