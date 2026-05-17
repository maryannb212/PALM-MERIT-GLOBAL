import bcrypt from 'bcryptjs';
import jsonwebtoken from 'jsonwebtoken';
import crypto from 'crypto';
import { createUser, findUserByEmail, findUserByPhone, findUserById, findUserByEmailOrPhone } from '../models/userModel.js';
import { query } from '../config/db.js';
import dotenv from 'dotenv';
import { createAndSaveOTP, verifyOTP as checkOTP, sendOTP } from '../services/otpService.js';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../utils/emailService.js';
import { createPaystackVirtualAccount } from '../services/virtualAccountService.js';

dotenv.config();

const generateAccessToken = (id) => {
  return jsonwebtoken.sign({ id }, process.env.JWT_SECRET || 'secret', {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '2h',
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

    if (!firstName || !lastName || !phone || !password) {
      return res.status(400).json({ message: 'Please provide all required fields including phone number' });
    }

    const normalizedPhone = phone.trim();
    const normalizedEmail = email ? email.trim().toLowerCase() : null;

    // Check phone existence
    const { rows: phoneMatch } = await query('SELECT id, phone FROM users WHERE phone = $1', [normalizedPhone]);
    if (phoneMatch.length > 0) {
      return res.status(400).json({ 
        message: `User with phone number ${normalizedPhone} already exists`,
        debug: { 
          receivedPhone: phone,
          normalizedPhone: normalizedPhone,
          matchedPhone: phoneMatch[0].phone 
        }
      });
    }

    // Check email existence (if provided)
    if (normalizedEmail) {
      const { rows: emailMatch } = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
      if (emailMatch.length > 0) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }
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
      RETURNING id, first_name, last_name, email, phone, role, has_paid_membership, kyc_status, profile_image, created_at;
    `;
    const emailToSave = email ? email : null;
    const { rows: newUser } = await query(sql, [firstName, lastName, emailToSave, passwordHash, normalizedPhone, role]);
    const user = newUser[0];

    if (user) {
      // Send Welcome Email (Non-blocking) if email exists
      if (user.email) {
        sendWelcomeEmail(user).catch(err => console.error('Welcome email failed:', err));
      }

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
        virtual_account_number: user.virtual_account_number,
        virtual_bank_name: user.virtual_bank_name,
        virtual_account_name: user.virtual_account_name,
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

    const user = await findUserByEmailOrPhone(email);

    if (user && (await bcrypt.compare(password, user.password_hash))) {
      // OTP BYPASSED per user request
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
        virtual_account_number: user.virtual_account_number,
        virtual_bank_name: user.virtual_bank_name,
        virtual_account_name: user.virtual_account_name,
        token: accessToken,
        refreshToken: refreshToken,
        requiresOTP: false
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
      return res.status(400).json({ message: 'Phone/Email and OTP code are required' });
    }

    const user = await findUserByEmailOrPhone(email);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isValid = await checkOTP(user.id, code, 'login');
    
    if (!isValid) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // OTP is valid, update last_login (Non-blocking)
    query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]).catch(err => {
      console.error('[Auth] Failed to update last_login:', err.message);
    });

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
      virtual_account_number: user.virtual_account_number,
      virtual_bank_name: user.virtual_bank_name,
      virtual_account_name: user.virtual_account_name,
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
    const { phone } = req.body;
    const user = await findUserByPhone(phone);

    if (!user) {
      return res.status(404).json({ message: 'User with this phone number does not exist' });
    }

    // Generate and save OTP for password reset
    const otp = await createAndSaveOTP(user.id, 'reset');
    
    // Send OTP via SMS (Non-blocking)
    sendOTP(user.phone, otp.code).catch(err => {
      console.error('[Auth Service] Background Password Reset OTP delivery failed:', err.message);
    });

    res.json({ 
      message: 'Password reset OTP sent to your phone',
      mockOtp: process.env.NODE_ENV !== 'production' ? otp.code : undefined 
    });
  } catch (error) {
    console.error('Error in forgotPassword:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { phone, code, password } = req.body;
    
    if (!phone || !code || !password) {
      return res.status(400).json({ message: 'Phone, OTP code, and new password are required' });
    }

    const user = await findUserByPhone(phone);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isValid = await checkOTP(user.id, code, 'reset');
    
    if (!isValid) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
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
        u.virtual_account_number, u.virtual_bank_name, u.virtual_account_name,
        b.account_name, b.account_number, b.bank_name, b.bank_code,
        k.dob
      FROM users u
      LEFT JOIN bank_accounts b ON u.id = b.user_id
      LEFT JOIN kyc_details k ON u.id = k.user_id
      WHERE u.id = $1
    `;
    const { rows } = await query(sql, [userId]);
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
    
    let user = rows[0];

    // Get total members count
    const { rows: countRows } = await query("SELECT COUNT(*) FROM users WHERE role = 'user'");
    const totalMembers = parseInt(countRows[0].count, 10);

    // Retroactive Virtual Account Generation:
    // If the user is verified but doesn't have a virtual account (because it failed previously)
    if (user.kyc_status === 'verified' && !user.virtual_account_number) {
      try {
        const updatedAccount = await createPaystackVirtualAccount(userId);
        if (updatedAccount) {
          user.virtual_account_number = updatedAccount.virtual_account_number;
          user.virtual_account_name = updatedAccount.virtual_account_name;
          user.virtual_bank_name = updatedAccount.virtual_bank_name;
        }
      } catch (err) {
        console.error('Failed retroactive virtual account generation:', err);
      }
    }

    res.json({
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      hasPaidMembership: user.has_paid_membership,
      kycStatus: user.kyc_status,
      dob: user.dob,
      walletBalance: user.wallet_balance,
      profileImage: user.profile_image,
      virtual_account_number: user.virtual_account_number,
      virtual_bank_name: user.virtual_bank_name,
      virtual_account_name: user.virtual_account_name,
      totalMembers: totalMembers,
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
