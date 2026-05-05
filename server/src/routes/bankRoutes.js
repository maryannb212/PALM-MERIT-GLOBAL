import express from 'express';
import { addBankDetails, getBankDetails, resolveAccountNumber } from '../controllers/bankController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, addBankDetails);
router.get('/', protect, getBankDetails);
router.get('/resolve', protect, resolveAccountNumber);

export default router;
