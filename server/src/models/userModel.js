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

export const findUserByPhone = async (phone) => {
  const sql = `SELECT * FROM users WHERE phone = $1;`;
  const result = await query(sql, [phone]);
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
