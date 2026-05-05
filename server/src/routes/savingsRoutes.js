import express from 'express';
import { subscribeToPlan, getMyPlans, payClearanceFee, payTshirtFee } from '../controllers/savingsController.js';
import { protect, checkMembership } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/subscribe').post(protect, checkMembership, subscribeToPlan);
router.route('/my-plans').get(protect, checkMembership, getMyPlans);
router.route('/pay-clearance').post(protect, checkMembership, payClearanceFee);
router.route('/pay-tshirt').post(protect, payTshirtFee);

export default router;
