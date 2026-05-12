import express from 'express';
import { 
  registerUser, 
  loginUser, 
  verifyLoginOTP, 
  forgotPassword, 
  resetPassword,
  refreshToken,
  logoutUser
} from '../controllers/authController.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/verify-otp', verifyLoginOTP);
router.post('/refresh', refreshToken);
router.post('/logout', logoutUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
