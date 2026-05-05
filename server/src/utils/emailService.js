import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send a generic email
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} text - Plain text content
 * @param {string} html - HTML content
 */
export const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Palm Merit Global'}" <${process.env.EMAIL_FROM || 'info@palmmeritglobal.com'}>`,
      to,
      subject,
      text,
      html,
    });

    console.log(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    // Don't throw error in dev to avoid breaking the flow if SMTP is not configured
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email sending failed');
    }
  }
};

/**
 * Send Welcome Email
 */
export const sendWelcomeEmail = async (user) => {
  const subject = 'Welcome to Palm Merit Global!';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 10px;">
      <h2 style="color: #0A6847; text-align: center;">Welcome, ${user.firstName}!</h2>
      <p>Thank you for joining <strong>Palm Merit Global</strong>. We are excited to have you as a member of our community.</p>
      <p>With Palm Merit, you can manage your savings, participate in community programmes, and grow your financial future.</p>
      <div style="background-color: #f4f7f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Next Steps:</strong></p>
        <ul style="margin-top: 10px;">
          <li>Activate your membership.</li>
          <li>Complete your KYC verification.</li>
          <li>Explore our savings packages.</li>
        </ul>
      </div>
      <p>If you have any questions, feel free to reach out to our support team.</p>
      <p style="margin-top: 30px;">Best regards,<br>The Palm Merit Team</p>
    </div>
  `;

  return sendEmail({
    to: user.email,
    subject,
    text: `Welcome to Palm Merit Global, ${user.firstName}! Thank you for joining us.`,
    html,
  });
};

/**
 * Send Email Verification Link
 */
export const sendVerificationEmail = async (email, token) => {
  const verificationUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
  const subject = 'Verify Your Email - Palm Merit Global';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 10px;">
      <h2 style="color: #0A6847; text-align: center;">Email Verification</h2>
      <p>Thank you for registering with Palm Merit Global. Please click the button below to verify your email address:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationUrl}" style="background-color: #0A6847; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Verify Email</a>
      </div>
      <p>If you did not create an account, please ignore this email.</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #777;">If you're having trouble clicking the button, copy and paste the URL below into your browser:</p>
      <p style="font-size: 12px; color: #777;">${verificationUrl}</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject,
    text: `Verify your email by clicking here: ${verificationUrl}`,
    html,
  });
};

/**
 * Send Password Reset Email
 */
export const sendPasswordResetEmail = async (email, resetToken) => {
  const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
  const subject = 'Password Reset Request - Palm Merit Global';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 10px;">
      <h2 style="color: #0A6847; text-align: center;">Password Reset Request</h2>
      <p>You are receiving this email because you (or someone else) have requested the reset of the password for your account.</p>
      <p>Please click on the button below to complete the process:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #0A6847; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
      </div>
      <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
      <p>This link will expire in 30 minutes.</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #777;">If you're having trouble clicking the "Reset Password" button, copy and paste the URL below into your web browser:</p>
      <p style="font-size: 12px; color: #777;">${resetUrl}</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject,
    text: `You requested a password reset. Use this link: ${resetUrl}`,
    html,
  });
};

/**
 * Send Login OTP Email
 */
export const sendOTPEmail = async (email, code) => {
  const subject = 'Your Palm Merit Login OTP';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 10px;">
      <h2 style="color: #0A6847; text-align: center;">Verification Code</h2>
      <p>Your verification code for Palm Merit Global is:</p>
      <div style="text-align: center; margin: 30px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #0A6847; background-color: #f4f7f6; padding: 10px 20px; border-radius: 5px; border: 1px dashed #0A6847;">
          ${code}
        </span>
      </div>
      <p>This code will expire in 10 minutes. Do not share this code with anyone.</p>
      <p>If you did not request this code, please secure your account immediately.</p>
      <p style="margin-top: 30px;">Best regards,<br>The Palm Merit Team</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject,
    text: `Your Palm Merit verification code is: ${code}`,
    html,
  });
};
