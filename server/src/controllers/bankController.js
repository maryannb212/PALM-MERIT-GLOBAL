import { query } from '../config/db.js';
import axios from 'axios';

/**
 * Resolve bank account name using Paystack
 * GET /api/bank-details/resolve?account_number=...&bank_code=...
 */
export const resolveAccountNumber = async (req, res) => {
  try {
    const { account_number, bank_code } = req.query;

    if (!account_number || !bank_code) {
      return res.status(400).json({ message: 'Account number and bank code are required' });
    }

    const response = await axios.get(
      `https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
      }
    );

    res.json(response.data.data);
  } catch (error) {
    console.error('Resolve Account Error:', error.response?.data || error.message);
    res.status(400).json({ 
      message: error.response?.data?.message || 'Could not resolve account name. Please enter it manually.' 
    });
  }
};

/**
 * Add or update bank details
 * POST /api/bank-details
 */
export const addBankDetails = async (req, res) => {
  try {
    const { accountName, accountNumber, bankName, bankCode } = req.body;
    const userId = req.user.id;

    if (!accountName || !accountNumber || !bankName) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const sql = `
      INSERT INTO bank_accounts (user_id, account_name, account_number, bank_name, bank_code, is_primary)
      VALUES ($1, $2, $3, $4, $5, TRUE)
      ON CONFLICT (user_id) DO UPDATE SET
        account_name = EXCLUDED.account_name,
        account_number = EXCLUDED.account_number,
        bank_name = EXCLUDED.bank_name,
        bank_code = EXCLUDED.bank_code,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    // Note: To use ON CONFLICT (user_id), we need a unique constraint on user_id in bank_accounts.
    // I'll add that constraint in the next step or update the SQL to find then update.
    
    // For now, let's just use a simple logic: if exists update, else insert.
    const checkSql = `SELECT id FROM bank_accounts WHERE user_id = $1`;
    const { rows: existing } = await query(checkSql, [userId]);

    let result;
    if (existing.length > 0) {
      const updateSql = `
        UPDATE bank_accounts 
        SET account_name = $1, account_number = $2, bank_name = $3, bank_code = $4, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $5
        RETURNING *;
      `;
      result = await query(updateSql, [accountName, accountNumber, bankName, bankCode || null, userId]);
    } else {
      const insertSql = `
        INSERT INTO bank_accounts (user_id, account_name, account_number, bank_name, bank_code, is_primary)
        VALUES ($1, $2, $3, $4, $5, TRUE)
        RETURNING *;
      `;
      result = await query(insertSql, [userId, accountName, accountNumber, bankName, bankCode || null]);
    }

    res.status(201).json({
      message: 'Bank details saved successfully',
      bankDetails: result.rows[0]
    });
  } catch (error) {
    console.error('Error adding bank details:', error);
    res.status(500).json({ message: 'Server error saving bank details' });
  }
};

/**
 * Get user bank details
 * GET /api/bank-details
 */
export const getBankDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const sql = `SELECT * FROM bank_accounts WHERE user_id = $1`;
    const { rows } = await query(sql, [userId]);
    
    res.json(rows[0] || null);
  } catch (error) {
    console.error('Error fetching bank details:', error);
    res.status(500).json({ message: 'Server error fetching bank details' });
  }
};
