import axios from 'axios';

const API = axios.create({
  baseURL: '/api',
});

// Attach JWT token to every request if it exists in localStorage
API.interceptors.request.use((config) => {
  const userInfo = localStorage.getItem('palmmerit_user');
  if (userInfo) {
    const { token } = JSON.parse(userInfo);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

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

export default API;
