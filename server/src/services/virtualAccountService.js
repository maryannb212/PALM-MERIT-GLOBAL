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
  if (!/^\d{11}$/.test(bvn)) {
    throw new Error('Invalid BVN format. BVN must be 11 digits.');
  }

  const cleanPhone = (user.phone || '').replace(/[^0-9]/g, '');
  if (!cleanPhone || cleanPhone.length < 10) {
    throw new Error('Valid phone number is required to create a virtual account.');
  }

  if (!user.first_name || !user.last_name) {
    throw new Error('First name and last name are required to create a virtual account.');
  }

  const payload = {
    currency: 'NGN',
    customer: {
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email || `user${user.id}@palmmeritglobal.com`,
      mobile_no: cleanPhone,
      bvn
    }
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
    const status = error.response?.status;
    const data = error.response?.data;
    console.error('[VirtualAccountService] Lotus API error:', JSON.stringify({ status, data, payload }));
    
    let message = 'Lotus Bank virtual account creation failed';
    if (data) {
      if (typeof data === 'string') {
        message = data;
      } else if (data.message) {
        message = data.message;
      } else if (data.error) {
        message = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      } else if (data.errors) {
        message = Array.isArray(data.errors) ? data.errors.join(', ') : JSON.stringify(data.errors);
      } else if (data.detail) {
        message = data.detail;
      } else {
        message = JSON.stringify(data);
      }
    } else if (error.message) {
      message = error.message;
    }
    
    throw new Error(message);
  }
};


