import bcrypt from 'bcryptjs';
import jsonwebtoken from 'jsonwebtoken';
import crypto from 'crypto';
import { createUser, findUserByEmail, findUserById } from '../models/userModel.js';
import { query } from '../config/db.js';
import dotenv from 'dotenv';
import { createAndSaveOTP, verifyOTP as checkOTP, sendOTP } from '../services/otpService.js';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../utils/emailService.js';

dotenv.config();

const generateAccessToken = (id) => {
  return jsonwebtoken.sign({ id }, process.env.JWT_SECRET || 'secret', {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });
};

const generateRefreshToken = async (userId) => {
  const token = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, token, expiresAt]
  );

  return token;
};

export const registerUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const userExists = await findUserByEmail(email);

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Check if this is the first user
    // const { rows: userCount } = await query('SELECT count(*) FROM users');
    // const role = parseInt(userCount[0].count) === 0 ? 'admin' : 'user';
    const role = 'user'; // Default all registrations to 'user'

    const sql = `
      INSERT INTO users (first_name, last_name, email, password_hash, phone, role)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, first_name, last_name, email, role, has_paid_membership, kyc_status, profile_image, created_at;
    `;
    const { rows: newUser } = await query(sql, [firstName, lastName, email, passwordHash, phone, role]);
    const user = newUser[0];

    if (user) {
      // Send Welcome Email (Non-blocking)
      sendWelcomeEmail(user).catch(err => console.error('Welcome email failed:', err));

      const accessToken = generateAccessToken(user.id);
      const refreshToken = await generateRefreshToken(user.id);

      res.status(201).json({
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role,
        hasPaidMembership: user.has_paid_membership,
        kycStatus: user.kyc_status,
        profileImage: user.profile_image,
        token: accessToken,
        refreshToken: refreshToken
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('Error in registerUser:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await findUserByEmail(email);

    if (user && (await bcrypt.compare(password, user.password_hash))) {
      // Generate and save OTP
      const otp = await createAndSaveOTP(user.id, 'login');
      
      // Send OTP via SMS/Email
      await sendOTP(user.phone || user.email, otp.code);

      res.json({
        message: 'OTP sent successfully',
        requiresOTP: true,
        email: user.email,
        mockOtp: process.env.NODE_ENV !== 'production' ? otp.code : undefined
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('Error in loginUser:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

export const verifyLoginOTP = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: 'Email and OTP code are required' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isValid = await checkOTP(user.id, code, 'login');
    
    if (!isValid) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // OTP is valid, update last_login
    await query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    const accessToken = generateAccessToken(user.id);
    const refreshToken = await generateRefreshToken(user.id);

    res.json({
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      role: user.role,
      hasPaidMembership: user.has_paid_membership,
      kycStatus: user.kyc_status,
      profileImage: user.profile_image,
      token: accessToken,
      refreshToken: refreshToken
    });
  } catch (error) {
    console.error('Error in verifyLoginOTP:', error);
    res.status(500).json({ message: 'Server error during OTP verification' });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    const { rows } = await query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP',
      [refreshToken]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    const userId = rows[0].user_id;
    const accessToken = generateAccessToken(userId);

    res.json({ token: accessToken });
  } catch (error) {
    console.error('Error in refreshToken:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const logoutUser = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error in logoutUser:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await findUserByEmail(email);

    if (!user) {
      return res.status(404).json({ message: 'User with this email does not exist' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 mins

    await query(
      'UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE id = $3',
      [resetTokenHash, expires, user.id]
    );

    // Send Reset Email
    sendPasswordResetEmail(email, resetToken).catch(err => console.error('Reset email failed:', err));

    res.json({ 
      message: 'Password reset link sent to your email',
      token: process.env.NODE_ENV === 'development' ? resetToken : undefined 
    });
  } catch (error) {
    console.error('Error in forgotPassword:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const sql = `
      SELECT * FROM users 
      WHERE reset_password_token = $1 AND reset_password_expires > CURRENT_TIMESTAMP
    `;
    const { rows } = await query(sql, [resetTokenHash]);

    if (rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    const user = rows[0];
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await query(
      'UPDATE users SET password_hash = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2',
      [passwordHash, user.id]
    );

    res.json({ message: 'Password reset successful. You can now login with your new password.' });
  } catch (error) {
    console.error('Error in resetPassword:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const sql = `
      SELECT 
        u.id, u.first_name, u.last_name, u.email, u.role, u.phone,
        u.has_paid_membership, u.kyc_status, u.wallet_balance, u.profile_image, u.created_at,
        b.account_name, b.account_number, b.bank_name, b.bank_code
      FROM users u
      LEFT JOIN bank_accounts b ON u.id = b.user_id
      WHERE u.id = $1
    `;
    const { rows } = await query(sql, [userId]);
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
    
    const user = rows[0];
    res.json({
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      hasPaidMembership: user.has_paid_membership,
      kycStatus: user.kyc_status,
      walletBalance: user.wallet_balance,
      profileImage: user.profile_image,
      bankDetails: user.account_number ? {
        accountName: user.account_name,
        accountNumber: user.account_number,
        bankName: user.bank_name,
        bankCode: user.bank_code
      } : null
    });
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    res.status(500).json({ message: 'Server error fetching profile' });
  }
};
