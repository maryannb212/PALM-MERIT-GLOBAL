import cron from 'node-cron';
import { getClient, query } from '../config/db.js';
import { applyDailyInterest } from '../services/interestEngine.js';
import { createNotification } from '../models/notificationModel.js';
import { createWalletLedgerEntry } from '../models/transactionModel.js';

const PLAN_CONFIG = {
  'CREST': { weekly: 4000, penalty: 4000 },
  'SILVER': { weekly: 1500, penalty: 1500 },
  'GOLDEN_BASKET': { weekly: 2000, penalty: 2000 },
  'ISUSU': { daily: 500, penalty: 500 }
};

const getWATDateString = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
};

export const runPenaltyCheck = async () => {
  console.log('Running penalty check job...');
  try {
    const watDateStr = getWATDateString();
    const { rows: activePlans } = await query("SELECT * FROM savings_plans WHERE status = 'active'");

    for (const plan of activePlans) {
      const config = PLAN_CONFIG[plan.plan_name];
      if (!config) continue;

      const isDaily = !!config.daily;
      const numAccounts = plan.number_of_accounts || 1;
      const expectedInstallment = (config.weekly || config.daily) * numAccounts;
      const penaltyAmount = config.penalty * numAccounts;

      const { rows: todaySavings } = await query(`
        SELECT id FROM transactions
        WHERE plan_id = $1 AND type = 'savings' AND status = 'completed'
          AND DATE(created_at AT TIME ZONE 'Africa/Lagos') = $2
        LIMIT 1
      `, [plan.id, watDateStr]);

      const { rows: todayDefault } = await query(`
        SELECT id FROM defaults
        WHERE plan_id = $1 AND missed_date = $2 LIMIT 1
      `, [plan.id, watDateStr]);

      if (todaySavings.length > 0 || todayDefault.length > 0) continue;

      const { rows: lastTx } = await query(`
        SELECT created_at FROM transactions
        WHERE plan_id = $1 AND type IN ('savings', 'penalty') AND status = 'completed'
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

      const client = await getClient();
      try {
        await client.query('BEGIN');

        const { rows: users } = await client.query(
          'SELECT id, available_balance FROM users WHERE id = $1 FOR UPDATE',
          [plan.user_id]
        );
        if (users.length === 0) {
          await client.query('ROLLBACK');
          client.release();
          continue;
        }

        const balance = Math.floor(parseFloat(users[0].available_balance));
        const ref = `PEN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // ── Per-account granularity ──
        const perAccountAmount = Math.floor(expectedInstallment / numAccounts);
        const fullDue = expectedInstallment;
        const payableAccounts = Math.floor(balance / perAccountAmount);
        const payableAmount = payableAccounts * perAccountAmount;
        const savingsAmount = Math.min(payableAmount, fullDue);

        if (savingsAmount > 0) {
          await client.query('UPDATE users SET available_balance = available_balance - $1, wallet_balance = wallet_balance - $1 WHERE id = $2', [savingsAmount, plan.user_id]);
          await client.query('UPDATE savings_plans SET current_amount = current_amount + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [savingsAmount, plan.id]);
          await client.query(`INSERT INTO transactions (user_id, plan_id, type, amount, status, reference) VALUES ($1, $2, 'savings', $3, 'completed', $4)`, [plan.user_id, plan.id, savingsAmount, ref]);
          await createWalletLedgerEntry(client, plan.user_id, 'debit', savingsAmount, ref, `Automatic savings deduction for ${plan.plan_name}`);

          await client.query('COMMIT');

          let msg = `Your savings deduction of N${savingsAmount.toLocaleString()} for ${plan.plan_name} was successful`;
          if (savingsAmount < fullDue) {
            const paidAccounts = savingsAmount / perAccountAmount;
            msg += ` (${paidAccounts} of ${numAccounts} accounts paid)`;
          }
          msg += '.';
          await createNotification(plan.user_id, 'SYSTEM', 'Savings Deduction Successful', msg);
          console.log(`Penalty job: saved N${savingsAmount} for plan ${plan.id}.`);
        } else {
          // ── Insufficient funds — create a default ──
          const defaultPenalty = perAccountAmount * numAccounts;
          await client.query(`INSERT INTO defaults (user_id, plan_id, missed_date, penalty_amount) VALUES ($1, $2, $3, $4)`, [plan.user_id, plan.id, watDateStr, defaultPenalty]);
          await client.query('COMMIT');

          await createNotification(
            plan.user_id, 'ALERT', 'Savings Default Recorded',
            `Your ${plan.plan_name} plan missed the contribution of N${defaultPenalty.toLocaleString()} due to insufficient wallet balance. A default has been recorded for ${watDateStr}.`
          );
          console.log(`Plan ${plan.id}: insufficient funds (N${balance}) — defaulted N${defaultPenalty}.`);
        }
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error processing penalty check for plan ${plan.id}:`, err);
      } finally {
        client.release();
      }
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
