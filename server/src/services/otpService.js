import { query } from '../config/db.js';
import { sendOTPEmail } from '../utils/emailService.js';
import { sendTermiiSMS } from '../utils/termiiService.js';

/**
 * Generate a 6-digit OTP
 */
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Create and save OTP for a user
 */
export const createAndSaveOTP = async (userId, type = 'login') => {
  const code = generateOTP();
  // Expires in 10 minutes
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const sql = `
    INSERT INTO otp_codes (user_id, code, type, expires_at)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  
  const result = await query(sql, [userId, code, type, expiresAt]);
  return result.rows[0];
};

/**
 * Verify an OTP
 */
export const verifyOTP = async (userId, code, type = 'login') => {
  const sql = `
    SELECT * FROM otp_codes
    WHERE user_id = $1 AND code = $2 AND type = $3 AND used = FALSE AND expires_at > CURRENT_TIMESTAMP
    ORDER BY created_at DESC
    LIMIT 1;
  `;
  
  const result = await query(sql, [userId, code, type]);
  
  if (result.rows.length === 0) {
    return false;
  }

  // Mark as used
  const updateSql = `UPDATE otp_codes SET used = TRUE WHERE id = $1`;
  await query(updateSql, [result.rows[0].id]);

  return true;
};

/**
 * Send OTP (via SMS with Email Fallback)
 */
export const sendOTP = async (contactInfo, code) => {
  // In development, we still log to console for convenience
  console.log(`\n=========================================`);
  console.log(`[OTP GENERATED] To: ${contactInfo}, Code: ${code}`);
  console.log(`=========================================\n`);
  
  // Basic check to see if contactInfo looks like a phone number
  // E.g., consists mostly of digits, may have '+', '-', ' ', '()'
  const isPhoneNumber = /^[+\d\-\s()]{10,15}$/.test(contactInfo);

  if (isPhoneNumber) {
    try {
      await sendTermiiSMS(contactInfo, `Your Palm Merit Global OTP is: ${code}. It expires in 10 minutes.`);
      return true; // Successfully sent SMS
    } catch (error) {
      console.error('[OTP Service] SMS failed. Fallback to Email if possible.', error.message);
      // If we had the user's email here, we could fallback. 
      // For now, if SMS fails, we might just fail, or assume contactInfo was an email by mistake.
    }
  }

  // If it's not a phone number, or SMS failed (and we treat it as an email)
  // In a real app, you'd pass both phone and email to this function.
  // Assuming contactInfo is an email if it's not a phone number:
  if (contactInfo.includes('@')) {
    try {
      await sendOTPEmail(contactInfo, code);
      return true;
    } catch (error) {
      console.error('[OTP Service] Email failed:', error.message);
    }
  }

  return false;
};
