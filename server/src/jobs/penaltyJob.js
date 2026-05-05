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
    console.log('Running daily penalty check job...');
    try {
      // Find all active savings plans
      const sql = `SELECT * FROM savings_plans WHERE status = 'active'`;
      const { rows: activePlans } = await query(sql);

      const today = new Date();

      for (const plan of activePlans) {
        const config = PLAN_CONFIG[plan.plan_name];
        if (!config) continue;

        const startDate = new Date(plan.start_date);
        const diffTime = Math.abs(today - startDate);
        
        let expectedAmount = 0;
        if (config.weekly) {
          const weeksPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
          expectedAmount = weeksPassed * config.weekly;
        } else if (config.daily) {
          const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          expectedAmount = daysPassed * config.daily;
        }

        // If the current amount is less than expected, it's a default
        if (plan.current_amount < expectedAmount) {
          const penaltyAmount = config.penalty;
          
          // Check if we already recorded a default for today or recently
          const checkDefaultSql = `
            SELECT * FROM defaults 
            WHERE plan_id = $1 AND missed_date = CURRENT_DATE
          `;
          const existingDefault = await query(checkDefaultSql, [plan.id]);

          if (existingDefault.rows.length === 0) {
            console.log(`Applying penalty of ${penaltyAmount} to plan ${plan.id} (${plan.plan_name})`);
            
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

            // Deduct from wallet if possible, or just log it
            // Here we'll just send a notification
            await createNotification(
              plan.user_id,
              'ALERT',
              'Penalty Applied',
              `A penalty of ${penaltyAmount} has been applied to your ${plan.plan_name} plan due to missed contributions.`
            );
          }
        }
      }
    } catch (error) {
      console.error('Error running penalty cron job:', error);
    }
  });
};
