import bcrypt from 'bcryptjs';
import jsonwebtoken from 'jsonwebtoken';
import crypto from 'crypto';
import { createUser, findUserByEmail, findUserByPhone, findUserById, findUserByEmailOrPhone } from '../models/userModel.js';
import { query } from '../config/db.js';
import dotenv from 'dotenv';
import { createAndSaveOTP, verifyOTP as checkOTP, sendOTP } from '../services/otpService.js';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../utils/emailService.js';
import { createVirtualAccount } from '../services/virtualAccountService.js';
import { getReferredDownlines, getActiveQualifiedCount } from '../helpers/referralHelper.js';
import admin from '../config/firebaseAdmin.js';

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
    const { firstName, lastName, email, password, phone, referredByCode, middleName, dob, address, nearestBusStop, nokName, nokRelationship, nokPhone, firebaseToken } = req.body;

    if (!firstName || !lastName || !phone || !password || !firebaseToken) {
      return res.status(400).json({ message: 'Please provide all required fields including phone verification.' });
    }

    // Verify Firebase token
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(firebaseToken);
    } catch (err) {
      return res.status(400).json({ message: 'Invalid or expired phone verification token.' });
    }

    const verifiedPhone = decodedToken.phone_number;

    // Normalize phone
    let normalizedPhone = phone.trim();
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '+234' + normalizedPhone.substring(1);
    } else if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = '+234' + normalizedPhone;
    }

    if (verifiedPhone !== normalizedPhone) {
      return res.status(400).json({ message: 'Verified phone number does not match provided phone number' });
    }

    const normalizedEmail = (email && email.trim() !== '') ? email.trim().toLowerCase() : null;

    // Check storage existence and validate referred code in a single parallel round-trip
    const validationPromises = [
      query('SELECT id, phone FROM users WHERE phone = $1', [normalizedPhone])
    ];

    if (normalizedEmail) {
      validationPromises.push(query('SELECT id FROM users WHERE email = $1', [normalizedEmail]));
    } else {
      validationPromises.push(Promise.resolve({ rows: [] }));
    }

    if (referredByCode && referredByCode.trim()) {
      validationPromises.push(query('SELECT id, referral_unlock_date FROM users WHERE referral_code = $1', [referredByCode.trim()]));
    } else {
      validationPromises.push(Promise.resolve({ rows: [] }));
    }

    const [phoneMatchRes, emailMatchRes, referrerRes] = await Promise.all(validationPromises);

    const phoneMatch = phoneMatchRes.rows;
    if (phoneMatch.length > 0) {
      return res.status(400).json({ 
        message: `User with phone number ${normalizedPhone} already exists`
      });
    }

    const emailMatch = emailMatchRes.rows;
    if (normalizedEmail && emailMatch.length > 0) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Validate Referred By Code if provided
    let referredById = null;
    const referrerRows = referrerRes.rows;
    if (referredByCode && referredByCode.trim()) {
      if (referrerRows.length === 0) {
        return res.status(400).json({ message: 'Invalid referral code' });
      }

      const referrer = referrerRows[0];
      const unlockDate = referrer.referral_unlock_date ? new Date(referrer.referral_unlock_date) : null;
      if (unlockDate && unlockDate > new Date()) {
        return res.status(400).json({ message: 'This referral code is not yet activated/unlocked' });
      }
      referredById = referrer.id;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const role = 'user'; // Default all registrations to 'user'

    // Generate unique referral code for the new user
    let isUnique = false;
    let newReferralCode = '';
    while (!isUnique) {
      const f = (firstName || 'P').charAt(0).toUpperCase();
      const l = (lastName || 'M').charAt(0).toUpperCase();
      const randomNum = Math.floor(10000 + Math.random() * 90000);
      newReferralCode = `${f}X${l}-${randomNum}`;
      const { rows: checkCode } = await query('SELECT id FROM users WHERE referral_code = $1', [newReferralCode]);
      if (checkCode.length === 0) isUnique = true;
    }

    // Calculate Referral Unlock Date: Exactly 1 month after registration
    const createdDate = new Date();
    const unlockDate = new Date(createdDate);
    unlockDate.setMonth(unlockDate.getMonth() + 1);

    const sql = `
      INSERT INTO users (first_name, last_name, email, password_hash, phone, role, referral_code, referred_by, referral_unlock_date, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, first_name, last_name, email, phone, role, has_paid_membership, kyc_status, profile_image, referral_code, referral_unlock_date, created_at;
    `;
    const emailToSave = normalizedEmail;
    const { rows: newUser } = await query(sql, [
      firstName,
      lastName,
      emailToSave,
      passwordHash,
      normalizedPhone,
      role,
      newReferralCode,
      referredById,
      unlockDate,
      createdDate
    ]);
    const user = newUser[0];

    if (user) {
      // Save KYC details
      try {
        const kycSql = `
          INSERT INTO kyc_details (
            user_id, first_name, last_name, middle_name, phone, email, 
            address, nearest_bus_stop, dob, 
            nok_name, nok_relationship, nok_phone
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `;
        await query(kycSql, [
          user.id, firstName, lastName, middleName || null, normalizedPhone, emailToSave,
          address || null, nearestBusStop || null, dob || null,
          nokName || null, nokRelationship || null, nokPhone || null
        ]);
      } catch (kycErr) {
        console.error('Error saving KYC details during registration:', kycErr);
      }

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
        referralCode: user.referral_code,
        referralUnlockDate: user.referral_unlock_date,
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
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ message: 'Reset token and new password are required' });
    }

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (err) {
      console.error('Firebase token verification failed:', err.code, err.message);
      return res.status(400).json({ message: 'Invalid or expired reset token. Please request a new OTP.' });
    }

    const phone = decodedToken.phone_number;
    
    if (!phone) {
      return res.status(400).json({ message: 'Invalid reset token payload' });
    }

    const user = await findUserByPhone(phone); // Assuming phone is stored in E.164 format (+234...)

    if (!user) {
      // It's possible the user stored their phone as 080... instead of +234...
      // Let's try to convert +23480... to 080... and find again
      let localPhone = phone;
      if (phone.startsWith('+234')) {
        localPhone = '0' + phone.substring(4);
      }
      const userAlt = await findUserByPhone(localPhone);
      
      if (!userAlt) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Found with local phone
      await processPasswordReset(userAlt.id, password, res);
      return;
    }

    await processPasswordReset(user.id, password, res);

  } catch (error) {
    console.error('Error in resetPassword:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const processPasswordReset = async (userId, password, res) => {
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  await query(
    'UPDATE users SET password_hash = $1 WHERE id = $2',
    [passwordHash, userId]
  );

  res.json({ message: 'Password reset successful. You can now login with your new password.' });
};



export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const sql = `
      SELECT 
        u.id, u.first_name, u.last_name, u.email, u.role, u.phone,
        u.has_paid_membership, u.kyc_status, u.wallet_balance, u.available_balance, u.held_balance,
        u.profile_image, u.created_at,
        u.virtual_account_number, u.virtual_bank_name, u.virtual_account_name, u.virtual_provider,
        u.referral_code, u.referral_unlock_date,
        u.tshirt_paid, u.tshirt_payment_date,
        b.account_name, b.account_number, b.bank_name, b.bank_code,
        k.dob, k.middle_name, k.address, k.gender, k.bvn, k.id_type, k.id_number
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
    if (user.kyc_status === 'verified' && (!user.virtual_account_number || user.virtual_provider === 'system_fallback')) {
      try {
        const updatedAccount = await createVirtualAccount(userId);
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
      middleName: user.middle_name,
      address: user.address,
      gender: user.gender,
      bvn: user.bvn,
      id_type: user.id_type,
      id_number: user.id_number,
      walletBalance: user.wallet_balance,
      available_balance: user.available_balance,
      held_balance: user.held_balance,
      profileImage: user.profile_image,
      virtual_account_number: user.virtual_account_number,
      virtual_bank_name: user.virtual_bank_name,
      virtual_account_name: user.virtual_account_name,
      virtual_provider: user.virtual_provider,
      referralCode: user.referral_code,
      referralUnlockDate: user.referral_unlock_date,
      tshirt_paid: user.tshirt_paid || false,
      tshirt_payment_date: user.tshirt_payment_date || null,
      totalMembers: user.role === 'admin' ? totalMembers : null,
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

export const getMyReferrals = async (req, res) => {
  try {
    const userId = req.user.id;
    const downlines = await getReferredDownlines(userId);
    const activeQualifiedCount = await getActiveQualifiedCount(userId);
    res.json({
      downlines,
      activeQualifiedCount,
      eligibilityRequiredCount: 2,
      isEligible: activeQualifiedCount >= 2
    });
  } catch (error) {
    console.error('Error fetching referrals:', error);
    res.status(500).json({ message: 'Server error fetching referrals' });
  }
};

export const uploadProfileImage = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    // In production, req.file.path is the Cloudinary URL
    // In development, it's the local file path
    const imageUrl = req.file.path || req.file.location;

    await query(
      'UPDATE users SET profile_image = $1 WHERE id = $2',
      [imageUrl, userId]
    );

    res.json({ profileImage: imageUrl, message: 'Profile image updated successfully' });
  } catch (error) {
    console.error('Error uploading profile image:', error);
    res.status(500).json({ message: 'Server error uploading profile image' });
  }
};

export const removeProfileImage = async (req, res) => {
  try {
    const userId = req.user.id;

    await query(
      'UPDATE users SET profile_image = NULL WHERE id = $1',
      [userId]
    );

    res.json({ message: 'Profile image removed successfully' });
  } catch (error) {
    console.error('Error removing profile image:', error);
    res.status(500).json({ message: 'Server error removing profile image' });
  }
};

export const generateVirtualAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // First verify if the user already has one
    const { rows } = await query('SELECT virtual_account_number, virtual_bank_name, virtual_account_name, virtual_provider FROM users WHERE id = $1', [userId]);
    const user = rows[0];
    
    if (user?.virtual_account_number && user.virtual_provider !== 'system_fallback') {
      return res.json({
        message: 'Virtual account already exists',
        virtual_account_number: user.virtual_account_number,
        virtual_bank_name: user.virtual_bank_name,
        virtual_account_name: user.virtual_account_name
      });
    }

    const updatedAccount = await createVirtualAccount(userId);
    
    if (updatedAccount && updatedAccount.virtual_account_number) {
      res.json({
        message: 'Virtual account successfully generated',
        virtual_account_number: updatedAccount.virtual_account_number,
        virtual_bank_name: updatedAccount.virtual_bank_name,
        virtual_account_name: updatedAccount.virtual_account_name
      });
    } else {
      res.status(400).json({ message: 'Failed to generate virtual account' });
    }
  } catch (error) {
    console.error('Error generating virtual account:', error.message);
    res.status(500).json({ message: 'Server error while generating virtual account: ' + error.message });
  }
};
