import { getClient } from '../config/db.js';

/**
 * Interest Engine
 * Calculates and applies daily interest to all active savings plans.
 */
export const applyDailyInterest = async () => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1. Get all active savings plans with current balance > 0
    const fetchSql = `
      SELECT id, user_id, current_amount, interest_rate 
      FROM savings_plans 
      WHERE status = 'active' AND current_amount > 0;
    `;
    const { rows: plans } = await client.query(fetchSql);

    console.log(`[InterestEngine] Processing interest for ${plans.length} active plans...`);

    for (const plan of plans) {
      // Daily interest rate = (Annual Rate / 100) / 365
      const dailyRate = (parseFloat(plan.interest_rate) / 100) / 365;
      const interestAmount = parseFloat(plan.current_amount) * dailyRate;

      if (interestAmount > 0.01) { // Only apply if interest is at least 0.01 NGN
        // 2. Update the savings plan balance
        const updatePlanSql = `
          UPDATE savings_plans 
          SET current_amount = current_amount + $1, updated_at = CURRENT_TIMESTAMP 
          WHERE id = $2;
        `;
        await client.query(updatePlanSql, [interestAmount, plan.id]);

        // 3. Log the interest transaction
        const logTransactionSql = `
          INSERT INTO transactions (user_id, plan_id, type, amount, status, reference)
          VALUES ($1, $2, 'interest', $3, 'completed', $4);
        `;
        const reference = `INT-${plan.id.substring(0, 4)}-${Date.now().toString().slice(-6)}`;
        await client.query(logTransactionSql, [plan.user_id, plan.id, interestAmount, reference]);
      }
    }

    await client.query('COMMIT');
    console.log('[InterestEngine] Daily interest applied successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[InterestEngine] Error applying daily interest:', error);
  } finally {
    client.release();
  }
};
