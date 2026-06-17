import express from 'express';
import { 
  initializeTransaction, 
  verifyTransaction, 
  getMyTransactions, 
  paystackWebhook,
  lotusWebhook,
  uploadReceipt
} from '../controllers/transactionController.js';
import { virtualAccountWebhook } from '../controllers/webhookController.js';
import { requestWithdrawal } from '../controllers/withdrawalController.js';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Webhook routes
router.post('/webhook/paystack', paystackWebhook);
router.post('/webhook/virtual-account', virtualAccountWebhook);
router.post('/webhook/lotus', lotusWebhook);

router.post('/initialize', protect, initializeTransaction);
router.post('/withdraw', protect, requestWithdrawal);
router.get('/verify/:reference', verifyTransaction);
router.get('/my-transactions', protect, getMyTransactions);
router.post('/upload-receipt', protect, upload.single('receipt'), uploadReceipt);

export default router;
