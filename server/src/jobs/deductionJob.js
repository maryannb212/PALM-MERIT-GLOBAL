import cron from 'node-cron';
import { getClient, query } from '../config/db.js';
import { createNotification } from '../models/notificationModel.js';
import { createWalletLedgerEntry } from '../models/transactionModel.js';

const PLAN_CONFIG = {
  'CREST': { amount: 4000, isDaily: false },
  'SILVER': { amount: 1500, isDaily: false },
  'GOLDEN_BASKET': { amount: 2000, isDaily: false },
  'ISUSU': { amount: 500, isDaily: true }
};

const countExpectedContributions = (startDate, preferredDay, isDaily) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  if (start >= today) return 0;

  if (isDaily) {
    return Math.floor((today - start) / (1000 * 60 * 60 * 24));
  }

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDayIndex = daysOfWeek.findIndex(d => d.toLowerCase() === (preferredDay || '').toLowerCase());

  if (targetDayIndex === -1) {
    return Math.floor((today - start) / (1000 * 60 * 60 * 24 * 7));
  }

  let count = 0;
  const cursor = new Date(start);

  if (cursor.getDay() !== targetDayIndex) {
    count = 1;
    while (cursor.getDay() !== targetDayIndex) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
    }
  }

  while (cursor < today) {
    count++;
    cursor.setDate(cursor.getDate() + 7);
    cursor.setHours(0, 0, 0, 0);
  }

  return count;
};

export const runStartupCatchupDeductions = async () => {
  console.log('--- Running Startup Catch-up for Missed Deductions ---');
  try {
    const { rows: activePlans } = await query("SELECT * FROM savings_plans WHERE status = 'active'");

    for (const plan of activePlans) {
      const config = PLAN_CONFIG[plan.plan_name];
      if (!config) continue;

      const expectedInstallment = config.amount * (plan.number_of_accounts || 1);
      const expectedCount = countExpectedContributions(plan.start_date, plan.preferred_day, config.isDaily);
      const expectedTotal = expectedCount * expectedInstallment;

      const client = await getClient();
      try {
        await client.query('BEGIN');

        const { rows: lockedPlans } = await client.query('SELECT current_amount FROM savings_plans WHERE id = $1 FOR UPDATE', [plan.id]);
        if (lockedPlans.length === 0) {
          await client.query('ROLLBACK');
          continue;
        }

        const currentAmount = parseFloat(lockedPlans[0].current_amount || 0);

        if (currentAmount < expectedTotal) {
          const owedAmount = expectedTotal - currentAmount;
          console.log(`Plan ${plan.id} (${plan.plan_name}) is behind. Expected: N${expectedTotal}, Actual: N${currentAmount}. Catching up N${owedAmount}...`);

          const { rows: users } = await client.query('SELECT id, available_balance FROM users WHERE id = $1 FOR UPDATE', [plan.user_id]);
          if (users.length === 0) throw new Error('User not found');

          const user = users[0];
          const availableBalance = parseFloat(user.available_balance);

          if (availableBalance >= owedAmount) {
            const reference = `CATCHUP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            await client.query('UPDATE users SET available_balance = available_balance - $1, wallet_balance = wallet_balance - $1 WHERE id = $2', [owedAmount, user.id]);
            await client.query('UPDATE savings_plans SET current_amount = current_amount + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [owedAmount, plan.id]);
            await client.query(`
              INSERT INTO transactions (user_id, plan_id, type, amount, status, reference)
              VALUES ($1, $2, 'savings', $3, 'completed', $4)
            `, [user.id, plan.id, owedAmount, reference]);
            await createWalletLedgerEntry(client, user.id, 'debit', owedAmount, reference, `Catch-up savings deduction for ${plan.plan_name}`);

            await client.query('COMMIT');

            await createNotification(
              user.id, 'SYSTEM', 'Catch-up Deduction Successful',
              `A catch-up deduction of N${owedAmount.toLocaleString()} was successfully processed for your ${plan.plan_name} plan for previously missed durations.`
            );
            console.log(`Successfully caught up N${owedAmount} for plan ${plan.id}`);
          } else {
            console.log(`Plan ${plan.id} missed deductions, but user has insufficient funds (N${availableBalance}) to catch up N${owedAmount}.`);
            await client.query('ROLLBACK');
          }
        } else {
          await client.query('ROLLBACK');
        }
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error processing catch-up for plan ${plan.id}:`, err);
      } finally {
        client.release();
      }
    }
    console.log('--- Startup Catch-up Complete ---');
  } catch (error) {
    console.error('Error running startup catch-up job:', error);
  }
};

export const runDeductionJob = async () => {
  console.log('Running automatic savings deduction job...');
  try {
    const watDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
    const todayDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][watDate.getDay()];
    const todayString = watDate.toDateString();
    const watDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });

    const { rows: activePlans } = await query("SELECT * FROM savings_plans WHERE status = 'active'");

    for (const plan of activePlans) {
      const config = PLAN_CONFIG[plan.plan_name];
      if (!config) continue;

      const expectedAmount = config.amount * (plan.number_of_accounts || 1);

      const client = await getClient();
      try {
        await client.query('BEGIN');

        const { rows: lockedPlans } = await client.query('SELECT * FROM savings_plans WHERE id = $1 FOR UPDATE', [plan.id]);
        if (lockedPlans.length === 0) {
          await client.query('ROLLBACK');
          continue;
        }

        const { rows: existingTransactions } = await client.query(`
          SELECT created_at FROM transactions
          WHERE plan_id = $1 AND type IN ('savings', 'penalty') AND status = 'completed'
          ORDER BY created_at DESC LIMIT 1
        `, [plan.id]);

        const { rows: todayDefault } = await client.query(`
          SELECT id FROM defaults
          WHERE plan_id = $1 AND missed_date = $2::date LIMIT 1
        `, [plan.id, watDateStr]);

        if (todayDefault.length > 0) {
          await client.query('ROLLBACK');
          continue;
        }

        const lastDeductionDate = existingTransactions.length > 0 ? existingTransactions[0].created_at : null;

        let isDue = false;

        if (config.isDaily) {
          if (!lastDeductionDate) {
            isDue = true;
          } else {
            const lastWatDate = new Date(new Date(lastDeductionDate).toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
            if (lastWatDate.toDateString() !== todayString) {
              isDue = true;
            }
          }
        } else {
          if (!lastDeductionDate) {
            if (plan.preferred_day && plan.preferred_day.trim().toLowerCase() === todayDayName.toLowerCase()) {
              isDue = true;
            } else {
              const daysSinceStart = Math.floor((watDate - new Date(plan.start_date)) / (1000 * 60 * 60 * 24));
              if (daysSinceStart >= 7) {
                isDue = true;
                console.log(`Plan ${plan.id} never deducted and it's been ${daysSinceStart} days. Catching up.`);
              }
            }
          } else {
            const daysSinceLast = Math.floor((watDate - new Date(lastDeductionDate)) / (1000 * 60 * 60 * 24));
            if (daysSinceLast >= 7) {
              isDue = true;
              console.log(`Plan ${plan.id} (${plan.plan_name}) missed its preferred day. Catching up now (Days since last: ${daysSinceLast}).`);
            }
          }
        }

        if (!isDue) {
          await client.query('ROLLBACK');
          continue;
        }

        const { rows: users } = await client.query('SELECT id, available_balance FROM users WHERE id = $1 FOR UPDATE', [plan.user_id]);
        if (users.length === 0) throw new Error('User not found');

        const balance = Math.floor(parseFloat(users[0].available_balance));
        const ref = `AUTOSAV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // ── Per-account granularity ──
        const perAccountAmount = config.amount;
        const numAccounts = plan.number_of_accounts || 1;
        const fullDue = perAccountAmount * numAccounts;
        const payableAccounts = Math.floor(balance / perAccountAmount);
        const payableAmount = payableAccounts * perAccountAmount;
        const savingsAmount = Math.min(payableAmount, fullDue);

        if (savingsAmount > 0) {
          await client.query('UPDATE users SET available_balance = available_balance - $1, wallet_balance = wallet_balance - $1 WHERE id = $2', [savingsAmount, plan.user_id]);
          await client.query('UPDATE savings_plans SET current_amount = current_amount + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [savingsAmount, plan.id]);
          await client.query(`INSERT INTO transactions (user_id, plan_id, type, amount, status, reference) VALUES ($1, $2, 'savings', $3, 'completed', $4)`, [plan.user_id, plan.id, savingsAmount, ref]);
          await createWalletLedgerEntry(client, plan.user_id, 'debit', savingsAmount, ref, `Automatic savings deduction for ${plan.plan_name}`);

          console.log(`Plan ${plan.id}: saved N${savingsAmount}.`);
        } else {
          console.log(`Plan ${plan.id}: insufficient funds (N${balance}) to cover even 1 account (N${perAccountAmount}). Defaulting N${fullDue}...`);
          
          // ── Create a default for the missed contribution ──
          await client.query(`
            INSERT INTO defaults (user_id, plan_id, missed_date, penalty_amount)
            VALUES ($1, $2, $3::date, $4)
          `, [plan.user_id, plan.id, watDateStr, fullDue]);
          
          // ── Insert SKIP- marker to prevent re-processing ──
          const skipRef = `SKIP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          await client.query(`INSERT INTO transactions (user_id, plan_id, type, amount, status, reference) VALUES ($1, $2, 'penalty', 0, 'completed', $3)`, [plan.user_id, plan.id, skipRef]);
          
          console.log(`Plan ${plan.id}: Default created for N${fullDue}.`);
        }

        await client.query('COMMIT');

        if (savingsAmount > 0) {
          let msg = `Your automatic savings deduction of N${savingsAmount.toLocaleString()} for your ${plan.plan_name} plan was successful`;
          if (savingsAmount < fullDue) {
            const paidAccounts = savingsAmount / perAccountAmount;
            msg += ` (${paidAccounts} of ${numAccounts} accounts paid)`;
          }
          msg += '.';
          await createNotification(plan.user_id, 'SYSTEM', 'Savings Deduction Successful', msg);
        } else {
          await createNotification(plan.user_id, 'SYSTEM', 'Missed Contribution',
            `Your ${plan.plan_name} plan contribution of N${fullDue.toLocaleString()} was not deducted due to insufficient wallet balance. A default of N${fullDue.toLocaleString()} has been recorded.`);
        }
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error processing deduction for plan ${plan.id}:`, err);
      } finally {
        client.release();
      }
    }

    return { success: true, message: 'Deduction job completed.' };
  } catch (error) {
    console.error('Error running deduction job:', error);
    throw error;
  }
};

export const startDeductionJob = () => {
  cron.schedule('0 18 * * *', async () => {
    console.log('--- Starting Daily Tasks (6PM WAT) ---');
    try {
      await runDeductionJob();
    } catch (error) {
      console.error('Error in deduction cron execution:', error);
    }
  }, { timezone: 'Africa/Lagos' });
};
