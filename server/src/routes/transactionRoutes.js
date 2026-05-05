import express from 'express';
import { 
  initializeTransaction, 
  verifyTransaction, 
  getMyTransactions, 
  paystackWebhook,
  flutterwaveWebhook
} from '../controllers/transactionController.js';
import { virtualAccountWebhook } from '../controllers/webhookController.js';
import { requestWithdrawal } from '../controllers/withdrawalController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Webhook routes
router.post('/webhook/paystack', paystackWebhook);
router.post('/webhook/flutterwave', flutterwaveWebhook);
router.post('/webhook/virtual-account', virtualAccountWebhook);

router.post('/initialize', protect, initializeTransaction);
router.post('/withdraw', protect, requestWithdrawal);
router.get('/verify/:reference', verifyTransaction);
router.get('/my-transactions', protect, getMyTransactions);

export default router;
