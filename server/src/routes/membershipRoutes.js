import express from 'express';
import { initializeTransaction, verifyTransaction } from '../controllers/transactionController.js';
import { uploadMembershipReceipt } from '../controllers/membershipController.js';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.post('/initialize', protect, initializeTransaction);
router.get('/verify/:reference', verifyTransaction);
router.post('/upload-receipt', protect, upload.single('receipt'), uploadMembershipReceipt);

export default router;
