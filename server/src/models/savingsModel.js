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
    SELECT sp.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', rc.id,
            'code', rc.code,
            'status', rc.status,
            'unlock_date', rc.unlock_date,
            'used_by_user_id', rc.used_by_user_id
          ) ORDER BY rc.created_at
        ) FILTER (WHERE rc.id IS NOT NULL),
        '[]'::json
      ) as referral_codes
    FROM savings_plans sp
    LEFT JOIN referral_codes rc ON rc.plan_id = sp.id
    WHERE sp.user_id = $1
    GROUP BY sp.id
    ORDER BY sp.created_at DESC;
  `;
  const result = await query(sql, [userId]);
  return result.rows;
};


