import express from 'express';
import { submitKYC, getKYCStatus, getPendingKYC, verifyUserKYC } from '../controllers/kycController.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.route('/submit').post(protect, upload.fields([
  { name: 'id_image', maxCount: 1 },
  { name: 'idBack', maxCount: 1 },
  { name: 'selfie', maxCount: 1 },
  { name: 'profile_image', maxCount: 1 }
]), submitKYC);
router.route('/status').get(protect, getKYCStatus);

// Admin Routes
router.route('/admin/pending').get(protect, admin, getPendingKYC);
router.route('/admin/verify/:userId').put(protect, admin, verifyUserKYC);

export default router;
