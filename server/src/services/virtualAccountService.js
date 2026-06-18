import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const LOTUS_BASE_URL = 'https://partnerhub.lotusbank.com/api/v1';

const cleanKey = (key) => (process.env[key] || '').trim().replace(/^["']|["']$/g, '') || '';

const getLotusMerchantKey = () => cleanKey('LOTUS_MERCHANT_KEY');
const getLotusXApiKey = () => cleanKey('LOTUS_X_API_KEY');

const getHeaders = () => ({
  'x-api-key': getLotusXApiKey(),
  'Content-Type': 'application/json'
});

export const createVirtualAccount = async (user) => {
  const apiKey = getLotusXApiKey();
  if (!apiKey) {
    throw new Error('Lotus Bank is not configured. Please contact support.');
  }

  const bvn = user.bvn || '';
  if (!bvn) {
    throw new Error('BVN is required to create a virtual account. Please complete your KYC submission first.');
  }

  const cleanPhone = (user.phone || '').replace(/[^0-9]/g, '');

  const baseUrl = (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'https://palmmeritglobal.com').replace(/\/$/, '');

  const payload = {
    currency: 'NGN',
    customer: {
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email || `user${user.id}@palmmeritglobal.com`,
      mobile_no: cleanPhone || user.phone || '',
      bvn
    },
    webhook_url: `${baseUrl}/api/transactions/webhook/lotus`
  };

  try {
    const response = await axios.post(
      `${LOTUS_BASE_URL}/virtual-account`,
      payload,
      {
        headers: getHeaders(),
        timeout: 15000
      }
    );

    if (!response.data?.success) {
      throw new Error(response.data?.message || 'Lotus Bank virtual account creation failed');
    }

    console.log('[VirtualAccountService] Lotus VA created. Full response:', JSON.stringify(response.data, null, 2));

    return response.data.data;
  } catch (error) {
    const detail = error.response?.data || error.response?.statusText || error.message;
    console.error('[VirtualAccountService] Lotus API error:', JSON.stringify({ status: error.response?.status, data: error.response?.data, payload }));
    throw new Error(typeof detail === 'object' ? JSON.stringify(detail) : detail);
  }
};


