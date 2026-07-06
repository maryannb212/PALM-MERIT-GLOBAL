import express from 'express';
import { subscribeToPlan, getMyPlans, payClearanceFee, payTshirtFee, cancelSubscription, getMyDefaults, getPlanDefaultsDetail, bulkClearance, clearDefaults, clearDefaultById } from '../controllers/savingsController.js';
import { protect, checkMembership } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/subscribe').post(protect, checkMembership, subscribeToPlan);
router.route('/my-plans').get(protect, checkMembership, getMyPlans);
router.route('/pay-clearance').post(protect, checkMembership, payClearanceFee);
router.route('/bulk-clearance').post(protect, checkMembership, bulkClearance);
router.route('/pay-tshirt').post(protect, payTshirtFee);
router.route('/cancel/:planId').delete(protect, cancelSubscription);
router.route('/my-defaults').get(protect, getMyDefaults);
router.route('/defaults/:planId').get(protect, getPlanDefaultsDetail);
router.route('/clear-defaults').post(protect, checkMembership, clearDefaults);
router.route('/clear-default/:defaultId').post(protect, checkMembership, clearDefaultById);

export default router;
