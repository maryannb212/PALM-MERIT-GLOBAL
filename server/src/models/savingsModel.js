import { query } from '../config/db.js';

export const createSavingsPlan = async (userId, planName, targetAmount, numberOfAccounts = 1, clearanceRequired = false, refundOnly = false) => {
  const sql = `
    INSERT INTO savings_plans (user_id, plan_name, target_amount, number_of_accounts, clearance_required, refund_only)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  const result = await query(sql, [userId, planName, targetAmount, numberOfAccounts, clearanceRequired, refundOnly]);
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
