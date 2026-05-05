import express from 'express';
import { 
  getAllUsers, 
  getUserById, 
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
  rejectWithdrawal
} from '../controllers/adminController.js';
import { getCashflowSummary } from '../controllers/cashflowController.js';
import { ceoLogin } from '../controllers/adminAuthController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public route for CEO login
router.post('/login', ceoLogin);

// Apply protect and admin middlewares to all routes in this file
router.use(protect, admin);

router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.get('/stats', getDashboardStats);
router.get('/tickets', getAllTickets);
router.put('/tickets/:id', updateTicket);
router.post('/notifications/broadcast', broadcastNotification);
router.get('/defaulters', getDefaulters);
router.get('/reconciliation', getReconciliationStats);
router.get('/cashflow', getCashflowSummary);
router.get('/transactions/pending', getPendingTransactions);
router.post('/approve-payment/:transactionId', approveManualPayment);
router.get('/withdrawals/pending', getPendingWithdrawals);
router.put('/withdrawals/:id/approve', approveWithdrawal);
router.put('/withdrawals/:id/reject', rejectWithdrawal);

export default router;
