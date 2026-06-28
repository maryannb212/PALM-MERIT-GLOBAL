import cron from 'node-cron';
import pool from '../config/db.js';
import logger from '../utils/logger.js';

const PLAN_CONFIG = {
  'CREST': { amount: 4000, isDaily: false, weeks: 12 },
  'SILVER': { amount: 1500, isDaily: false, weeks: 50 },
  'GOLDEN_BASKET': { amount: 2000, isDaily: false, weeks: 50 },
  'ISUSU': { amount: 500, isDaily: true, days: 30 }
};

const getDurationDays = (planName) => {
  switch (planName) {
    case 'CREST': return 90;
    case 'SILVER': return 360;
    case 'GOLDEN_BASKET': return 360;
    case 'ISUSU': return 30;
    default: return 0;
  }
};

const hasCompletedContributions = (plan) => {
  const config = PLAN_CONFIG[plan.plan_name];
  if (!config) return false;

  const numAccounts = plan.number_of_accounts || 1;
  if (config.isDaily) {
    const expected = config.amount * numAccounts * config.days;
    return parseFloat(plan.current_amount || 0) >= expected;
  }
  const expected = config.amount * numAccounts * config.weeks;
  return parseFloat(plan.current_amount || 0) >= expected;
};

export const runMaturityCheck = async () => {
  logger.info('Running maturity check job...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Fetch active plans to evaluate
    const { rows: activePlans } = await client.query(`
      SELECT id, user_id, plan_name, start_date, current_amount, number_of_accounts
      FROM savings_plans 
      WHERE status = 'active'
    `);

    for (const plan of activePlans) {
      const durationDays = getDurationDays(plan.plan_name);
      if (durationDays === 0) continue;

      // Determine the actual contribution start date from the first savings transaction
      const { rows: contribRows } = await client.query(
        `SELECT MIN(created_at) AS contribution_date FROM transactions WHERE plan_id = $1 AND type = 'savings'`,
        [plan.id]
      );
      const contributionDate = contribRows[0].contribution_date ? new Date(contribRows[0].contribution_date) : new Date(plan.start_date);
      const startDate = contributionDate;
      const maturityDate = new Date(startDate.getTime() + (durationDays * 24 * 60 * 60 * 1000));
      const now = new Date();

      if (now >= maturityDate) {
        // Check that required contributions have been completed
        if (!hasCompletedContributions(plan)) {
          logger.warn(`Plan ${plan.id} (${plan.plan_name}) reached maturity date but hasn't completed all contributions. Skipping.`);
          continue;
        }

        logger.info(`Plan ${plan.id} (${plan.plan_name}) has matured.`);

        const newStatus = 'eligibility_review';

        const updateQuery = `
          UPDATE savings_plans 
          SET status = $1, maturity_date = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `;
        await client.query(updateQuery, [newStatus, now, plan.id]);
      }
    }

    await client.query('COMMIT');
    logger.info('Maturity check job completed successfully.');
    return { success: true, message: 'Maturity check completed' };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error running maturity check job:', error);
    throw error;
  } finally {
    client.release();
  }
};

export const startMaturityJob = () => {
  cron.schedule('0 0 * * *', async () => {
    try {
      await runMaturityCheck();
    } catch (error) {
      logger.error('Error in maturity cron execution:', error);
    }
  });
};
