import express from 'express';
import { subscribeToPlan, getMyPlans, payClearanceFee, payTshirtFee, cancelSubscription, getMyDefaults, getPlanDefaultsDetail } from '../controllers/savingsController.js';
import { protect, checkMembership } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/subscribe').post(protect, checkMembership, subscribeToPlan);
router.route('/my-plans').get(protect, checkMembership, getMyPlans);
router.route('/my-defaults').get(protect, checkMembership, getMyDefaults);
router.route('/plan-defaults/:planId').get(protect, checkMembership, getPlanDefaultsDetail);
router.route('/pay-clearance').post(protect, checkMembership, payClearanceFee);
router.route('/pay-tshirt').post(protect, payTshirtFee);
router.route('/cancel/:planId').delete(protect, cancelSubscription);

export default router;
