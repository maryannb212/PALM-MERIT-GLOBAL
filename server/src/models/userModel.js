import { query } from '../config/db.js';

export const createUser = async (firstName, lastName, email, passwordHash, phone) => {
  const sql = `
    INSERT INTO users (first_name, last_name, email, password_hash, phone)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, first_name, last_name, email, role, has_paid_membership, kyc_status, profile_image, available_balance, held_balance, wallet_balance, tshirt_paid, created_at;
  `;
  const result = await query(sql, [firstName, lastName, email, passwordHash, phone]);
  return result.rows[0];
};

export const findUserByEmail = async (email) => {
  const sql = `SELECT * FROM users WHERE email = $1;`;
  const result = await query(sql, [email]);
  return result.rows[0];
};

/**
 * Normalize a phone number to +234 international format.
 * Handles inputs like: 08012345678, 8012345678, +2348012345678, 2348012345678
 */
export const normalizePhone = (phone) => {
  if (!phone) return phone;
  let p = phone.trim();
  if (p.startsWith('0')) {
    p = '+234' + p.substring(1);
  } else if (p.startsWith('234') && !p.startsWith('+')) {
    p = '+' + p;
  } else if (!p.startsWith('+') && p.length <= 10) {
    p = '+234' + p;
  }
  return p;
};

export const findUserByPhone = async (phone) => {
  // Try normalized (+234) format first, then fall back to the raw input
  const normalized = normalizePhone(phone);
  const sql = `SELECT * FROM users WHERE phone = $1 OR phone = $2 LIMIT 1;`;
  const result = await query(sql, [normalized, phone]);
  return result.rows[0];
};

export const findUserByEmailOrPhone = async (identifier) => {
  if (!identifier) return null;
  const trimmed = identifier.trim();
  // If it looks like a phone number, normalize it and search both formats
  const isPhone = /^[+\d\-\s()]{7,15}$/.test(trimmed);
  if (isPhone) {
    const normalized = normalizePhone(trimmed);
    const sql = `SELECT * FROM users WHERE phone = $1 OR phone = $2 LIMIT 1;`;
    const result = await query(sql, [normalized, trimmed]);
    return result.rows[0];
  }
  // Otherwise treat as email (case-insensitive)
  const sql = `SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1;`;
  const result = await query(sql, [trimmed]);
  return result.rows[0];
};

export const findUserById = async (id) => {
  const sql = `SELECT id, first_name, last_name, email, phone, role, has_paid_membership, kyc_status, profile_image, available_balance, held_balance, wallet_balance, tshirt_paid, tshirt_payment_date, created_at FROM users WHERE id = $1;`;
  const result = await query(sql, [id]);
  return result.rows[0];
};

/**
 * Compute balance from ledger (wallet_transactions)
 */
export const getUserLedgerBalance = async (userId) => {
  const sql = `
    SELECT 
      SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END) as balance
    FROM wallet_transactions
    WHERE user_id = $1;
  `;
  const result = await query(sql, [userId]);
  return parseFloat(result.rows[0].balance || 0);
};

export const setMembershipPaid = async (userId) => {
  const sql = `UPDATE users SET has_paid_membership = TRUE WHERE id = $1 RETURNING *;`;
  const result = await query(sql, [userId]);
  return result.rows[0];
};
