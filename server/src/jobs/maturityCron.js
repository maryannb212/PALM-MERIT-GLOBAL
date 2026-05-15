import cron from 'node-cron';
import pool from '../config/db.js';
import logger from '../utils/logger.js';

export const runMaturityCheck = async () => {
  logger.info('Running maturity check job...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Fetch active plans to evaluate
    const { rows: activePlans } = await client.query(`
      SELECT id, user_id, plan_name, start_date 
      FROM savings_plans 
      WHERE status = 'active'
    `);

    for (const plan of activePlans) {
      let durationDays = 0;
      
      switch (plan.plan_name) {
        case 'CREST':
          durationDays = 90;
          break;
        case 'SILVER':
          durationDays = 360;
          break;
        case 'GOLDEN_BASKET':
          durationDays = 360;
          break;
        case 'ISUSU':
          durationDays = 30;
          break;

      }

      const startDate = new Date(plan.start_date);
      const maturityDate = new Date(startDate.getTime() + (durationDays * 24 * 60 * 60 * 1000));
      const now = new Date();

      if (now >= maturityDate) {
        logger.info(`Plan ${plan.id} (${plan.plan_name}) has matured.`);

        let newStatus = 'matured'; // Fallback
        let payoutDate = null;

        if (['CREST', 'SILVER'].includes(plan.plan_name)) {
          newStatus = 'pending_clearance';
        } else if (plan.plan_name === 'GOLDEN_BASKET') {
          // ISUSU or others
          newStatus = 'pending_settlement';
          payoutDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // +7 days
        } else {
          // Others
          newStatus = 'pending_settlement';
          payoutDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
        }

        const updateQuery = `
          UPDATE savings_plans 
          SET status = $1, maturity_date = $2, payout_date = $3, updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
        `;
        await client.query(updateQuery, [newStatus, now, payoutDate, plan.id]);

        if (newStatus === 'pending_settlement') {
          const payoutType = plan.plan_name === 'GOLDEN_BASKET' ? 'goods' : 'cash';
          await client.query(`
            INSERT INTO payouts (user_id, plan_id, amount, payout_type, status)
            VALUES ($1, $2, $3, $4, 'pending')
          `, [plan.user_id, plan.id, null, payoutType]);
        }
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
