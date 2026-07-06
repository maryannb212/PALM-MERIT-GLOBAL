import { query } from '../config/db.js';

export const generateUniqueReferralCode = async (planName) => {
  const prefix = planName === 'SILVER' ? 'PMG-SIL' : planName === 'CREST' ? 'PMG-CST' : 'PMG-REF';
  let isUnique = false;
  let code = '';
  
  while (!isUnique) {
    const randomNum = Math.floor(10000 + Math.random() * 90000); // 5 digits
    code = `${prefix}-${randomNum}`;
    const { rows } = await query('SELECT id FROM referral_codes WHERE code = $1', [code]);
    if (rows.length === 0) {
      isUnique = true;
    }
  }
  return code;
};

export const createReferralCodeForPlan = async (client, userId, planId, planName, numberOfAccounts = 1) => {
  let status = 'available';
  let baseUnlockDate = null;

  if (planName === 'CREST') {
    status = 'locked';
    const d = new Date();
    d.setDate(d.getDate() + 30);
    baseUnlockDate = d.toISOString();
  } else {
    status = 'available';
    baseUnlockDate = new Date().toISOString();
  }

  const codes = [];
  for (let i = 0; i < numberOfAccounts; i++) {
    const code = await generateUniqueReferralCode(planName);
    const { rows } = await client.query(
      `INSERT INTO referral_codes (user_id, plan_id, code, status, unlock_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *;`,
      [userId, planId, code, status, baseUnlockDate]
    );
    codes.push(rows[0]);
  }
  return codes;
};

export const getUserReferralCodes = async (userId) => {
  await query(
    `UPDATE referral_codes
     SET status = 'available', updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND status = 'locked' AND unlock_date IS NOT NULL AND unlock_date <= NOW()`,
    [userId]
  );

  const sql = `
    SELECT r.id, r.code, r.status, r.unlock_date, r.used_by_user_id, r.created_at,
           s.plan_name as plan_name, s.status as plan_status,
           u.first_name as used_by_first_name, u.last_name as used_by_last_name
    FROM referral_codes r
    LEFT JOIN savings_plans s ON r.plan_id = s.id
    LEFT JOIN users u ON r.used_by_user_id = u.id
    WHERE r.user_id = $1 AND (s.status IS NULL OR s.status != 'cancelled')
    ORDER BY r.created_at DESC
  `;
  const { rows } = await query(sql, [userId]);
  return rows;
};
