import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const LOTUS_BASE_URL = 'https://partnerhub.lotusbank.com/api/v1';

const cleanKey = (key) => (process.env[key] || '').trim().replace(/^["']|["']$/g, '') || '';

const getLotusMerchantKey = () => cleanKey('LOTUS_MERCHANT_KEY');
const getLotusXApiKey = () => cleanKey('LOTUS_X_API_KEY');

const getHeaders = () => ({
  Authorization: getLotusMerchantKey(),
  'x-api-key': getLotusXApiKey(),
  'Content-Type': 'application/json'
});

export const createVirtualAccount = async (user) => {
  const apiKey = getLotusXApiKey();
  const merchantKey = getLotusMerchantKey();
  if (!apiKey || !merchantKey) {
    throw new Error('Lotus Bank is not configured. Please contact support.');
  }

  const bvn = user.bvn || '';
  if (!bvn) {
    throw new Error('BVN is required to create a virtual account. Please complete your KYC submission first.');
  }

  const cleanPhone = (user.phone || '').replace(/[^0-9]/g, '');

  const payload = {
    currency: 'NGN',
    customer: {
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email || `user${user.id}@palmmeritglobal.com`,
      mobile_no: cleanPhone || user.phone || '',
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

    const account = response.data.data;
    if (!account?.account_number || !account?.account_name || !account?.bank_name) {
      throw new Error('Lotus Bank returned incomplete virtual account details.');
    }

    console.log('[VirtualAccountService] Lotus virtual account created successfully.');
    return account;
  } catch (error) {
    const providerData = error.response?.data;
    const detail = typeof providerData === 'string'
      ? providerData
      : providerData?.message || providerData?.error || error.response?.statusText || error.message;
    const message = typeof detail === 'string' ? detail : JSON.stringify(detail);
    console.error('[VirtualAccountService] Lotus API error:', JSON.stringify({
      status: error.response?.status,
      code: error.code,
      message
    }));
    throw new Error(message);
  }
};


