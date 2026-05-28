import axios from 'axios';
import { query } from '../config/db.js';

const FLUTTERWAVE_SECRET = process.env.FLUTTERWAVE_SECRET_KEY;
const MERCHANT_BVN = process.env.FLUTTERWAVE_MERCHANT_BVN;

/**
 * Create Virtual Account on Flutterwave.
 * Uses the merchant's BVN (set in env) so individual users don't need to provide theirs.
 */
export const createVirtualAccount = async (userId) => {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [userId]);
  const user = rows[0];

  if (!user) throw new Error('User not found');
  if (user.virtual_account_number && user.virtual_provider !== 'system_fallback') return user;

  // Guard: Flutterwave requires a BVN for permanent virtual accounts
  if (!MERCHANT_BVN) {
    console.error('[VirtualAccount] FLUTTERWAVE_MERCHANT_BVN is not set in environment variables!');
    throw new Error('Virtual account generation is not configured. Please set FLUTTERWAVE_MERCHANT_BVN.');
  }

  if (!FLUTTERWAVE_SECRET) {
    console.error('[VirtualAccount] FLUTTERWAVE_SECRET_KEY is not set in environment variables!');
    throw new Error('Virtual account generation is not configured. Please set FLUTTERWAVE_SECRET_KEY.');
  }

  const payload = {
    email: user.email || `user${userId}@palmmeritglobal.com`,
    is_permanent: true,
    bvn: MERCHANT_BVN,
    tx_ref: `VA-${userId}-${Date.now()}`,
    firstname: user.first_name,
    lastname: user.last_name,
    phonenumber: user.phone,
    narration: `${user.first_name} ${user.last_name}`
  };

  console.log('[VirtualAccount] Requesting Flutterwave VA for user:', user.email);

  try {
    const response = await axios.post('https://api.flutterwave.com/v3/virtual-account-numbers', payload, {
      headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET}` }
    });

    console.log('[VirtualAccount] Flutterwave response:', JSON.stringify(response.data));

    const account = response.data.data;

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
      account.note || `${user.first_name} ${user.last_name}`,
      account.bank_name,
      'flutterwave',
      userId
    ]);

    console.log('[VirtualAccount] Successfully created VA:', account.account_number, account.bank_name);
    return result.rows[0];
  } catch (error) {
    const errData = error.response?.data || error.message;
    console.error('[VirtualAccount] Flutterwave API Error:', JSON.stringify(errData));
    throw new Error(`Flutterwave rejected the request: ${JSON.stringify(errData)}`);
  }
};
