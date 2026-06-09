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

export const createReferralCodeForPlan = async (client, userId, planId, planName) => {
  let status = 'available';
  let unlockDate = null;

  if (planName === 'CREST') {
    status = 'locked';
    const d = new Date();
    d.setDate(d.getDate() + 30);
    unlockDate = d.toISOString();
  } else if (planName === 'SILVER') {
    status = 'available';
    unlockDate = new Date().toISOString();
  } else {
    // Only Silver and Crest generate codes based on the new rules
    return null;
  }

  const code = await generateUniqueReferralCode(planName);

  const sql = `
    INSERT INTO referral_codes (user_id, plan_id, code, status, unlock_date)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;
  const { rows } = await client.query(sql, [userId, planId, code, status, unlockDate]);
  return rows[0];
};

export const getUserReferralCodes = async (userId) => {
  const sql = `
    SELECT r.id, r.code, r.status, r.unlock_date, r.used_by_user_id, r.created_at,
           s.plan_name as plan_name, s.status as plan_status,
           u.first_name as used_by_first_name, u.last_name as used_by_last_name
    FROM referral_codes r
    LEFT JOIN savings_plans s ON r.plan_id = s.id
    LEFT JOIN users u ON r.used_by_user_id = u.id
    WHERE r.user_id = $1
    ORDER BY r.created_at DESC
  `;
  const { rows } = await query(sql, [userId]);
  return rows;
};
