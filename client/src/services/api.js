import axios from 'axios';

const productionURL = 'https://palm-merit-global.onrender.com';
const baseURL = (import.meta.env.VITE_API_URL || (import.meta.env.PROD ? productionURL : '')) + '/api';

const API = axios.create({
  baseURL,
});

// Attach JWT token to every request if it exists in localStorage
API.interceptors.request.use((config) => {
  // Determine if this is an admin request
  const isAdminRequest = config.url.includes('/admin') || config.url.includes('/ambassadors');
  
  const storageKey = isAdminRequest ? 'palmmerit_admin' : 'palmmerit_user';
  const userInfo = localStorage.getItem(storageKey);
  
  if (userInfo) {
    const { token } = JSON.parse(userInfo);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor for handling token expiration and error logging
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Production Error Logging
    if (import.meta.env.PROD) {
      console.error('[API Error]:', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const userInfo = JSON.parse(localStorage.getItem('palmmerit_user'));
      if (userInfo?.refreshToken) {
        try {
          const { data } = await axios.post(`${baseURL}/auth/refresh`, {
            refreshToken: userInfo.refreshToken,
          });
          userInfo.token = data.token;
          localStorage.setItem('palmmerit_user', JSON.stringify(userInfo));
          originalRequest.headers.Authorization = `Bearer ${data.token}`;
          return API(originalRequest);
        } catch (refreshError) {
          localStorage.removeItem('palmmerit_user');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const registerUser = (formData) => API.post('/auth/register', formData);
export const loginUser = (credentials) => API.post('/auth/login', credentials);
export const verifyOTP = (data) => API.post('/auth/verify-otp', data);
export const forgotPassword = (data) => API.post('/auth/forgot-password', data);
export const resetPassword = (data) => API.post('/auth/reset-password', data);

// Savings endpoints
export const subscribeToPlan = (planData) => API.post('/savings/subscribe', planData);
export const getMyPlans = () => API.get('/savings/my-plans');
export const payClearanceFee = (data) => API.post('/savings/pay-clearance', data);
export const payTshirtFee = () => API.post('/savings/pay-tshirt');

// Transaction endpoints
export const initializeTransaction = (data) => API.post('/transactions/initialize', data);
export const verifyTransaction = (ref) => API.get(`/transactions/verify/${ref}`);
export const initializeDeposit = initializeTransaction; // alias
export const verifyDeposit = verifyTransaction; // alias
export const requestWithdrawal = (data) => API.post('/transactions/withdraw', data);
export const getMyTransactions = () => API.get('/transactions/my-transactions');

// Profile endpoint
export const getProfile = () => API.get('/auth/profile');

// Membership endpoints
export const initializeMembership = (data) => API.post('/membership/initialize', data);
export const verifyMembership = (ref) => API.get(`/membership/verify/${ref}`);
export const uploadMembershipReceipt = (formData) => API.post('/membership/upload-receipt', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

// KYC endpoints
export const submitKYC = (data) => API.post('/kyc/submit', data, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const getKYCStatus = () => API.get('/kyc/status');
export const getPendingKYC = () => API.get('/kyc/admin/pending');
export const updateKYCStatus = (userId, data) => API.put(`/kyc/admin/verify/${userId}`, data);

// Bank detail endpoints
export const saveBankDetails = (data) => API.post('/bank-details', data);
export const getBankDetails = () => API.get('/bank-details');
export const resolveBank = (account, bank) => API.get(`/bank-details/resolve?account_number=${account}&bank_code=${bank}`);

// Ticket endpoints
export const createTicket = (data) => API.post('/tickets', data);
export const getMyTickets = () => API.get('/tickets');

// Admin endpoints
export const adminLogin = (credentials) => API.post('/admin/login', credentials);
export const getAdminStats = () => API.get('/admin/stats');
export const getAllUsers = () => API.get('/admin/users');
export const updateAdminUser = (id, data) => API.put(`/admin/users/${id}`, data);
export const deleteAdminUser = (id) => API.delete(`/admin/users/${id}`);
export const getAllAdminTickets = () => API.get('/admin/tickets');
export const updateAdminTicket = (id, data) => API.put(`/admin/tickets/${id}`, data);
export const getPendingPayouts = () => API.get('/admin/payouts');
export const approvePayout = (data) => API.post('/admin/approve-payout', data);
export const getDefaulters = () => API.get('/admin/defaulters');
export const getReconciliation = () => API.get('/admin/reconciliation');
export const getPendingTransactions = () => API.get('/admin/transactions/pending');
export const getPendingWithdrawals = () => API.get('/admin/withdrawals/pending');
export const approveWithdrawal = (id) => API.put(`/admin/withdrawals/${id}/approve`);
export const rejectWithdrawal = (id, data) => API.put(`/admin/withdrawals/${id}/reject`, data);
export const broadcastNotification = (data) => API.post('/admin/notifications/broadcast', data);
export const approveManualPayment = (transactionId) => API.post(`/admin/approve-payment/${transactionId}`);
export const getCashflow = () => API.get('/admin/cashflow');

// Ambassador endpoints
export const getAmbassadors = () => API.get('/ambassadors');
export const addAmbassador = (data) => API.post('/ambassadors', data);
export const updateAmbassador = (id, data) => API.put(`/ambassadors/${id}`, data);
export const deleteAmbassador = (id) => API.delete(`/ambassadors/${id}`);

export default API;
