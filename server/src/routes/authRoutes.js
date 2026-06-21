import express from 'express';
import { 
  registerUser, 
  loginUser, 
  verifyLoginOTP, 
  forgotPassword, 
  resetPassword,
  refreshToken,
  logoutUser,
  getUserProfile,
  getMyReferrals,
  uploadProfileImage,
  removeProfileImage,
  generateVirtualAccount,
  updateBvn
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 15,
  message: { message: 'Too many authentication attempts, please try again after an hour' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', authLimiter, loginUser);
router.post('/verify-otp', authLimiter, verifyLoginOTP);
router.post('/refresh', refreshToken);
router.post('/logout', logoutUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/profile', protect, getUserProfile);
router.get('/referrals', protect, getMyReferrals);
router.put('/profile-image', protect, upload.single('profileImage'), uploadProfileImage);
router.delete('/profile-image', protect, removeProfileImage);
router.post('/generate-virtual-account', protect, generateVirtualAccount);
router.put('/bvn', protect, updateBvn);

export default router;
