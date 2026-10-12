import cron from 'node-cron';
import pool from '../config/db.js';
import logger from '../utils/logger.js';

const CYCLE_COMPLETION_DAYS = 84;
const ELIGIBILITY_REVIEW_DAYS = 90;

const getCycleDates = (startDate) => {
  const msPerDay = 24 * 60 * 60 * 1000;
  const completionDate = new Date(new Date(startDate).getTime() + (CYCLE_COMPLETION_DAYS * msPerDay));
  const reviewDate = new Date(new Date(startDate).getTime() + (ELIGIBILITY_REVIEW_DAYS * msPerDay));
  return { completionDate, reviewDate };
};

const hasCompletedContributions = (plan) => {
  const targetAmount = parseFloat(plan.target_amount || 0);
  return targetAmount > 0 && parseFloat(plan.current_amount || 0) >= targetAmount;
};

export const runMaturityCheck = async () => {
  logger.info('Running maturity check job...');
  const client = await pool.connect();
  const summary = { checked: 0, matured: 0, skippedIncomplete: 0 };

  try {
    await client.query('BEGIN');

    // Fetch active plans to evaluate
    const { rows: activePlans } = await client.query(`
      SELECT id, user_id, plan_name, start_date, current_amount, target_amount, number_of_accounts
      FROM savings_plans 
      WHERE status IN ('active', 'matured')
    `);

    for (const plan of activePlans) {
      summary.checked += 1;

      // Determine the actual contribution start date from the first savings transaction
      const { rows: contribRows } = await client.query(
        `SELECT MIN(created_at) AS contribution_date FROM transactions WHERE plan_id = $1 AND type = 'savings'`,
        [plan.id]
      );
      const contributionDate = contribRows[0].contribution_date ? new Date(contribRows[0].contribution_date) : new Date(plan.start_date);
      const startDate = contributionDate;
      const { completionDate, reviewDate } = getCycleDates(startDate);
      const now = new Date();

      if (now >= completionDate && hasCompletedContributions(plan)) {
        logger.info(`Plan ${plan.id} (${plan.plan_name}) has completed its savings cycle on day ${CYCLE_COMPLETION_DAYS}.`);
      }

      if (now >= reviewDate) {
        // Check that required contributions have been completed
        if (!hasCompletedContributions(plan)) {
          summary.skippedIncomplete += 1;
          logger.warn(`Plan ${plan.id} (${plan.plan_name}) reached eligibility review date but hasn't completed all contributions. Skipping.`);
          continue;
        }

        logger.info(`Plan ${plan.id} (${plan.plan_name}) has entered eligibility review.`);
        summary.matured += 1;

        const newStatus = 'eligibility_review';

        const updateQuery = `
          UPDATE savings_plans 
          SET status = $1, maturity_date = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `;
        await client.query(updateQuery, [newStatus, reviewDate, plan.id]);

        // Keep the transition and notification atomic so the daily job can retry both on failure.
        const msg = 'Congratulations! Your savings cycle has completed and you are now in eligibility review. Please complete your clearance process as required.';
        await client.query(`INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, 'clearance')`, [plan.user_id, 'Eligibility review started', msg]);
      }
    }

    await client.query('COMMIT');
    logger.info('Maturity check job completed successfully.');
    return { success: true, message: 'Maturity check completed', summary };
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
  }, { timezone: 'Africa/Lagos' });
};
