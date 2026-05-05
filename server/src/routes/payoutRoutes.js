import express from 'express';
import { getPendingPayouts, approvePayout } from '../controllers/payoutController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').get(protect, admin, getPendingPayouts);
router.route('/approve').post(protect, admin, approvePayout);

export default router;
