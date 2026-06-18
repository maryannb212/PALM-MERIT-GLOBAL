import express from 'express';
import { 
  getAllUsers, 
  getUserById, 
  updateUser,
  deleteUser,
  getDashboardStats, 
  getAllTickets, 
  updateTicket,
  broadcastNotification,
  getDefaulters,
  getReconciliationStats,
  approveManualPayment,
  getPendingTransactions,
  getPendingWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  getAdminReferralStats,
  getEligibilityQueue,
  approveEligibility,
  getWebhookLogs,
  getSystemStatus,
  getTransactionDebug, 
  getRecentTransfers, 
  deleteTestPayment,
  getUserDefaults,
  updateDefault,
  resolveUserDefaults,
  reconcileLotusVA
} from '../controllers/adminController.js';
import { getPendingPayouts, approvePayout } from '../controllers/payoutController.js';
import { getCashflowSummary } from '../controllers/cashflowController.js';
import { getFinancialReport } from '../controllers/financialReportController.js';
import { ceoLogin } from '../controllers/adminAuthController.js';
import { getPageLocks, updatePageLock, verifyPageLock } from '../controllers/adminSecurityController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public route for CEO login
router.post('/login', ceoLogin);

// Apply protect and admin middlewares to all routes in this file
router.use(protect, admin);

router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.get('/stats', getDashboardStats);
router.get('/tickets', getAllTickets);
router.put('/tickets/:id', updateTicket);
router.post('/notifications/broadcast', broadcastNotification);
router.get('/defaulters', getDefaulters);
router.get('/reconciliation', getReconciliationStats);
router.get('/cashflow', getCashflowSummary);
router.get('/financial-report', getFinancialReport);
router.get('/transactions/pending', getPendingTransactions);
router.post('/approve-payment/:transactionId', approveManualPayment);
router.get('/withdrawals/pending', getPendingWithdrawals);
router.put('/withdrawals/:id/approve', approveWithdrawal);
router.put('/withdrawals/:id/reject', rejectWithdrawal);
router.get('/payouts', getPendingPayouts);
router.post('/approve-payout', approvePayout);
router.get('/referrals', getAdminReferralStats);
router.get('/eligibility-queue', getEligibilityQueue);
router.post('/approve-eligibility', approveEligibility);
router.post('/reconcile-lotus-va', reconcileLotusVA);
router.get('/webhook-logs', getWebhookLogs);
router.get('/system-status', getSystemStatus);
router.get('/transaction-debug/:reference', getTransactionDebug);
router.get('/transactions/recent', getRecentTransfers);
router.delete('/payments/:id', deleteTestPayment);
// User Defaults
router.get('/users/:userId/defaults', getUserDefaults);
router.put('/defaults/:id', updateDefault);
router.post('/users/:userId/resolve-defaults', resolveUserDefaults);
// Security Locks
router.get('/security/locks', getPageLocks);
router.put('/security/locks', updatePageLock);
router.post('/security/verify', verifyPageLock);

export default router;
