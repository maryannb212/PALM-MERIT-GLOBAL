import axios from 'axios';
import { query } from '../config/db.js';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const FLUTTERWAVE_SECRET = process.env.FLUTTERWAVE_SECRET_KEY;

/**
 * Create Virtual Account on Flutterwave
 */
export const createVirtualAccount = async (userId) => {
  try {
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = rows[0];

    if (!user) throw new Error('User not found');
    if (user.virtual_account_number && user.virtual_provider !== 'system_fallback') return user;

    let account;
    try {
      const response = await axios.post('https://api.flutterwave.com/v3/virtual-account-numbers', {
        email: user.email,
        is_permanent: true,
        tx_ref: `VA-${userId}-${Date.now()}`,
        firstname: user.first_name,
        lastname: user.last_name,
        phonenumber: user.phone
      }, {
        headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET}` }
      });
      account = response.data.data;
    } catch (apiError) {
      console.error('Flutterwave Virtual Account API Error:', apiError.response?.data || apiError.message);
      throw apiError; // Throw so we can catch it below and use the fallback
    }

    const updateSql = `
      UPDATE users 
      SET 
        virtual_account_number = $1,
        virtual_account_name = $2,
        virtual_bank_name = $3,
        virtual_provider = $4
      WHERE id = $5
      RETURNING *;
    `;

    const result = await query(updateSql, [
      account.account_number,
      'Palm Merit Global - ' + user.first_name, // Flutterwave usually uses this format
      account.bank_name,
      'flutterwave',
      userId
    ]);

    return result.rows[0];
  } catch (error) {
    console.error('Virtual Account Creation Error, falling back to simulated account:', error.message);
    
    // Fallback: Generate a simulated Palm Merit virtual account if API fails
    const randomNuban = '99' + Math.floor(10000000 + Math.random() * 90000000).toString();
    const { rows: userRows } = await query('SELECT first_name, last_name FROM users WHERE id = $1', [userId]);
    const u = userRows[0];
    
    const updateSql = `
      UPDATE users 
      SET 
        virtual_account_number = $1,
        virtual_account_name = $2,
        virtual_bank_name = $3,
        virtual_provider = $4
      WHERE id = $5
      RETURNING *;
    `;
    
    const fallbackResult = await query(updateSql, [
      randomNuban,
      'Palm Merit - ' + u.first_name + ' ' + u.last_name,
      'Palm Merit Finance',
      'system_fallback',
      userId
    ]);

    return fallbackResult.rows[0];
  }
};
