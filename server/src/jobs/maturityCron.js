import cron from 'node-cron';
import pool from '../config/db.js';
import logger from '../utils/logger.js';

const CYCLE_COMPLETION_DAYS = 84;
const ELIGIBILITY_REVIEW_DAYS = 90;
const CLEARANCE_OPEN_DAYS = ELIGIBILITY_REVIEW_DAYS + 3;

const getCycleDates = (startDate) => {
  const msPerDay = 24 * 60 * 60 * 1000;
  const startDateInLagos = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(startDate));
  const cycleStart = new Date(`${startDateInLagos}T00:00:00+01:00`);
  const completionDate = new Date(cycleStart.getTime() + (CYCLE_COMPLETION_DAYS * msPerDay));
  const reviewDate = new Date(cycleStart.getTime() + (ELIGIBILITY_REVIEW_DAYS * msPerDay));
  const clearanceDate = new Date(cycleStart.getTime() + (CLEARANCE_OPEN_DAYS * msPerDay));
  return { completionDate, reviewDate, clearanceDate };
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
          SELECT id, user_id, plan_name, start_date, current_amount, target_amount,
           number_of_accounts, clearance_required, status
      FROM savings_plans 
          WHERE status IN ('active', 'matured', 'eligibility_review')
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
      const { completionDate, reviewDate, clearanceDate } = getCycleDates(startDate);
      const now = new Date();

      if (now >= completionDate && hasCompletedContributions(plan)) {
        logger.info(`Plan ${plan.id} (${plan.plan_name}) has completed its savings cycle on day ${CYCLE_COMPLETION_DAYS}.`);
      }

      if (now >= reviewDate) {
        const contributionsComplete = hasCompletedContributions(plan);
        const reviewDateLabel = reviewDate.toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'long', year: 'numeric' });
        const clearanceDateLabel = clearanceDate.toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'long', year: 'numeric' });

        if (!contributionsComplete) {
          summary.skippedIncomplete += 1;
          logger.warn(`Plan ${plan.id} (${plan.plan_name}) reached eligibility review date but hasn't completed all contributions.`);
          continue;
        }

        if (plan.status !== 'eligibility_review' && now < clearanceDate) {
          logger.info(`Plan ${plan.id} (${plan.plan_name}) has entered eligibility review.`);
          summary.matured += 1;
          await client.query(`
            UPDATE savings_plans
            SET status = 'eligibility_review', maturity_date = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [reviewDate, plan.id]);
        }

        const title = `Congratulations: ${plan.plan_name} savings cycle complete`;
        const msg = plan.clearance_required
          ? `Congratulations! You have completed your ${plan.plan_name} savings cycle. Your 90-day review date is ${reviewDateLabel}. Your clearance will be available on ${clearanceDateLabel} (three days after your 90-day review). You can then pay ₦3,000 per account under Dashboard > Clearance. Admin payout approval happens after your clearance is complete.`
          : `Congratulations! You have completed your ${plan.plan_name} savings cycle and reached your 90-day review date on ${reviewDateLabel}. Your plan is now ready for admin payout review.`;

        await client.query(`
          INSERT INTO notifications (user_id, title, message, type)
          SELECT $1, $2, $3, 'clearance'
          WHERE NOT EXISTS (
            SELECT 1 FROM notifications
            WHERE user_id = $1 AND title = $2 AND message = $3
          )
        `, [plan.user_id, title, msg]);

        if (plan.clearance_required && now >= clearanceDate && plan.status !== 'pending_clearance') {
          await client.query(`
            UPDATE savings_plans
            SET status = 'pending_clearance', clearance_required = TRUE,
                maturity_date = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [reviewDate, plan.id]);

          const clearanceTitle = `${plan.plan_name} clearance is now available`;
          const clearanceMessage = `Your clearance period has started. Pay ₦3,000 per account under Dashboard > Clearance. After all accounts are cleared, your plan will be ready for admin payout approval.`;
          await client.query(`
            INSERT INTO notifications (user_id, title, message, type)
            SELECT $1, $2, $3, 'clearance'
            WHERE NOT EXISTS (
              SELECT 1 FROM notifications
              WHERE user_id = $1 AND title = $2 AND message = $3
            )
          `, [plan.user_id, clearanceTitle, clearanceMessage]);
        }
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
