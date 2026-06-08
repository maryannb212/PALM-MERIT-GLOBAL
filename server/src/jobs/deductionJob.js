import cron from 'node-cron';
import { getClient, query } from '../config/db.js';
import { createNotification } from '../models/notificationModel.js';
import { createWalletLedgerEntry } from '../models/transactionModel.js';

// Plan rates configuration
const PLAN_CONFIG = {
  'CREST': { amount: 4000, isDaily: false },
  'SILVER': { amount: 1500, isDaily: false },
  'GOLDEN_BASKET': { amount: 2000, isDaily: false },
  'ISUSU': { amount: 500, isDaily: true }
};

/**
 * Helper to count how many contributions should have occurred by today.
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

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDayIndex = daysOfWeek.findIndex(d => d.toLowerCase() === (preferredDay || '').toLowerCase());

  if (targetDayIndex === -1) {
    const diffTime = today - start;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
  }

  let count = 0;
  const cursor = new Date(start);

  while (cursor.getDay() !== targetDayIndex) {
    cursor.setDate(cursor.getDate() + 1);
  }

  while (cursor < today) {
    count++;
    cursor.setDate(cursor.getDate() + 7);
  }

  return count;
};

export const runStartupCatchupDeductions = async () => {
  console.log('--- Running Startup Catch-up for Missed Deductions ---');
  try {
    const sql = `SELECT * FROM savings_plans WHERE status = 'active'`;
    const { rows: activePlans } = await query(sql);

    for (const plan of activePlans) {
      const config = PLAN_CONFIG[plan.plan_name];
      if (!config) continue;

      const expectedInstallment = config.amount * (plan.number_of_accounts || 1);
      const expectedCount = countExpectedContributions(plan.start_date, plan.preferred_day, config.isDaily);
      const expectedTotal = expectedCount * expectedInstallment;
      const currentAmount = parseFloat(plan.current_amount || 0);

      // If they are behind on their contributions (time has passed, but funds not added)
      if (currentAmount < expectedTotal) {
        const owedAmount = expectedTotal - currentAmount;
        console.log(`Plan ${plan.id} (${plan.plan_name}) is behind. Expected: ₦${expectedTotal}, Actual: ₦${currentAmount}. Catching up ₦${owedAmount}...`);

        const client = await getClient();
        try {
          await client.query('BEGIN');
          const { rows: users } = await client.query('SELECT id, available_balance, wallet_balance FROM users WHERE id = $1 FOR UPDATE', [plan.user_id]);
          if (users.length === 0) throw new Error('User not found');
          
          const user = users[0];
          const availableBalance = parseFloat(user.available_balance);

          if (availableBalance >= owedAmount) {
            const reference = `CATCHUP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            // Deduct from wallet
            await client.query(
              'UPDATE users SET available_balance = available_balance - $1, wallet_balance = wallet_balance - $1 WHERE id = $2',
              [owedAmount, user.id]
            );

            // Add to savings plan current_amount
            await client.query(
              'UPDATE savings_plans SET current_amount = current_amount + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
              [owedAmount, plan.id]
            );

            // Record transaction
            await client.query(`
              INSERT INTO transactions (user_id, plan_id, type, amount, status, reference)
              VALUES ($1, $2, 'savings', $3, 'completed', $4)
            `, [user.id, plan.id, owedAmount, reference]);

            // Record ledger entry
            await createWalletLedgerEntry(client, user.id, 'debit', owedAmount, reference, `Catch-up savings deduction for ${plan.plan_name}`);

            await client.query('COMMIT');

            // Notify Success
            await createNotification(
              user.id,
              'SYSTEM',
              'Catch-up Deduction Successful',
              `A catch-up deduction of ₦${owedAmount.toLocaleString()} was successfully processed for your ${plan.plan_name} plan for previously missed durations.`
            );
            console.log(`Successfully caught up ₦${owedAmount} for plan ${plan.id}`);
          } else {
            console.log(`Plan ${plan.id} missed deductions, but user has insufficient funds (₦${availableBalance}) to catch up ₦${owedAmount}.`);
            await client.query('ROLLBACK');
          }
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`Error processing catch-up for plan ${plan.id}:`, err);
        } finally {
          client.release();
        }
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
    // 1. Fetch all active savings plans
    const sql = `SELECT * FROM savings_plans WHERE status = 'active'`;
    const { rows: activePlans } = await query(sql);

    const todayDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

    for (const plan of activePlans) {
      const config = PLAN_CONFIG[plan.plan_name];
      if (!config) continue;

      const isDaily = config.isDaily;
      const expectedAmount = config.amount * (plan.number_of_accounts || 1);

      // 2 & 3. Determine if due and Prevent Double Deduction
      let isDue = false;

      // Query the transactions table to find the last successful deduction for this plan
      const checkLastDeductionSql = `
        SELECT created_at FROM transactions
        WHERE plan_id = $1 
          AND type = 'savings' 
          AND status = 'completed'
        ORDER BY created_at DESC LIMIT 1
      `;
      const { rows: existingTransactions } = await query(checkLastDeductionSql, [plan.id]);
      const lastDeductionDate = existingTransactions.length > 0 ? existingTransactions[0].created_at : null;

      if (isDaily) {
        // Daily Plans: Due if no deduction exists for today
        if (!lastDeductionDate || (new Date(lastDeductionDate).toDateString() !== new Date().toDateString())) {
          isDue = true;
        } else {
          console.log(`Plan ${plan.id} (${plan.plan_name}) already had a daily deduction today. Skipping.`);
        }
      } else {
        // Weekly Plans
        if (!lastDeductionDate) {
          // Never deducted via cron before. Due if today is their preferred day.
          if (plan.preferred_day && plan.preferred_day.toLowerCase() === todayDayName.toLowerCase()) {
            isDue = true;
          }
        } else {
          // Deducted before. Calculate days since last successful deduction
          const daysSinceLast = Math.floor((new Date() - new Date(lastDeductionDate)) / (1000 * 60 * 60 * 24));
          
          if (daysSinceLast >= 7) {
            // It has been a full week or more, so they missed their day (e.g., server was down). We must catch up and deduct now!
            isDue = true;
            console.log(`Plan ${plan.id} (${plan.plan_name}) missed its preferred day. Catching up now (Days since last: ${daysSinceLast}).`);
          } else if (daysSinceLast >= 6 && plan.preferred_day && plan.preferred_day.toLowerCase() === todayDayName.toLowerCase()) {
            // It's their preferred day again, and it's been ~6-7 days.
            isDue = true;
          } else {
            console.log(`Plan ${plan.id} (${plan.plan_name}) already had a weekly deduction in the last ${daysSinceLast} days. Skipping to prevent double-charge.`);
          }
        }
      }

      if (!isDue) {
        continue;
      }

      // 4. Attempt Deduction using a Transaction Block
      const client = await getClient();
      try {
        await client.query('BEGIN');

        // Lock the user row
        const { rows: users } = await client.query('SELECT id, available_balance, wallet_balance FROM users WHERE id = $1 FOR UPDATE', [plan.user_id]);
        if (users.length === 0) {
          throw new Error('User not found');
        }
        
        const user = users[0];
        const availableBalance = parseFloat(user.available_balance);

        const reference = `AUTOSAV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        if (availableBalance >= expectedAmount) {
          // Success Path
          // Deduct from wallet
          await client.query(
            'UPDATE users SET available_balance = available_balance - $1, wallet_balance = wallet_balance - $1 WHERE id = $2',
            [expectedAmount, user.id]
          );

          // Add to savings plan current_amount
          await client.query(
            'UPDATE savings_plans SET current_amount = current_amount + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [expectedAmount, plan.id]
          );

          // Record transaction
          await client.query(`
            INSERT INTO transactions (user_id, plan_id, type, amount, status, reference)
            VALUES ($1, $2, 'savings', $3, 'completed', $4)
          `, [user.id, plan.id, expectedAmount, reference]);

          // Record ledger entry
          await createWalletLedgerEntry(client, user.id, 'debit', expectedAmount, reference, `Automatic savings deduction for ${plan.plan_name}`);

          await client.query('COMMIT');

          // Notify Success
          await createNotification(
            user.id,
            'SYSTEM',
            'Savings Deduction Successful',
            `Your automatic savings deduction of ₦${expectedAmount.toLocaleString()} for your ${plan.plan_name} plan was successful.`
          );
          
          console.log(`Successfully deducted ${expectedAmount} for plan ${plan.id}`);

        } else {
          // Insufficient Funds Path
          // Record failed transaction so user is aware (but do not deduct)
          await client.query(`
            INSERT INTO transactions (user_id, plan_id, type, amount, status, reference)
            VALUES ($1, $2, 'savings', $3, 'failed', $4)
          `, [user.id, plan.id, expectedAmount, reference]);

          await client.query('COMMIT');

          // Notify Failure
          await createNotification(
            user.id,
            'ALERT',
            'Savings Deduction Failed',
            `Your automatic savings deduction of ₦${expectedAmount.toLocaleString()} for your ${plan.plan_name} plan failed due to insufficient funds. Please fund your wallet to avoid penalties.`
          );

          console.log(`Failed to deduct ${expectedAmount} for plan ${plan.id} due to insufficient funds.`);
        }

      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error processing deduction for plan ${plan.id}:`, err);
      } finally {
        client.release();
      }
    }

    return { success: true, message: 'Deduction job completed' };
  } catch (error) {
    console.error('Error running deduction job:', error);
    throw error;
  }
};

export const startDeductionJob = () => {
  // Run daily at 11:30 PM (23:30)
  // This runs slightly before the midnight penalty job (0 0 * * *), giving the deduction
  // a chance to process and update the plan's current_amount before penalties are assessed.
  cron.schedule('30 23 * * *', async () => {
    console.log('--- Starting Daily Automatic Deductions ---');
    try {
      await runDeductionJob();
    } catch (error) {
      console.error('Error in deduction cron execution:', error);
    }
  });
};
