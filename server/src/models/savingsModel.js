import { query } from '../config/db.js';

export const createSavingsPlan = async (userId, planName, targetAmount, numberOfAccounts = 1, clearanceRequired = false, refundOnly = false, preferredDay = null, client = null) => {
  // If preferredDay not provided, default to the current day's name (based on server time)
  if (!preferredDay) {
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    preferredDay = daysOfWeek[new Date().getDay()];
  }
  const sql = `
    INSERT INTO savings_plans (user_id, plan_name, target_amount, number_of_accounts, clearance_required, refund_only, preferred_day)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;
  const params = [userId, planName, targetAmount, numberOfAccounts, clearanceRequired, refundOnly, preferredDay];
  const result = client ? await client.query(sql, params) : await query(sql, params);
  return result.rows[0];
};

export const getUserSavingsPlans = async (userId) => {
  const sql = `
    SELECT * FROM savings_plans 
    WHERE user_id = $1 
    ORDER BY created_at DESC;
  `;
  const result = await query(sql, [userId]);
  return result.rows;
};

export const updateSavingsPlanAmount = async (planId, amountToAdd) => {
  const sql = `
    UPDATE savings_plans 
    SET current_amount = current_amount + $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *;
  `;
  const result = await query(sql, [planId, amountToAdd]);
  return result.rows[0];
};
