import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

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
 */
export const sendEmail = async ({ to, subject, text, html }) => {
  const fromName = process.env.EMAIL_FROM_NAME || 'Palm Merit Global';
  const defaultFromEmail = process.env.EMAIL_FROM || 'info@palmmeritglobal.com';
  const brevoEmail = process.env.BREVO_SENDER_EMAIL || defaultFromEmail;
  const from = `"${fromName}" <${defaultFromEmail}>`;
  
  try {
    if (process.env.NODE_ENV === 'production' && process.env.BREVO_API_KEY) {
      const payload = {
        sender: { name: fromName, email: brevoEmail },
        to: [{ email: to }],
        subject: subject,
        htmlContent: html,
        textContent: text
      };
      const response = await axios.post('https://api.brevo.com/v3/smtp/email', payload, {
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'accept': 'application/json',
          'content-type': 'application/json'
        }
      });
      console.log(`Email sent via Brevo to ${to}`);
      return { success: true, messageId: response.data.messageId };
    } else if (process.env.NODE_ENV === 'production' && process.env.SENDGRID_API_KEY) {
      const msg = { to, from, subject, text, html };
      await sgMail.send(msg);
      console.log(`Email sent via SendGrid to ${to}`);
      return { success: true };
    } else {
      const info = await transporter.sendMail({ from, to, subject, text, html });
      console.log(`Email sent via Nodemailer: ${info.messageId}`);
      return info;
    }
  } catch (error) {
    console.error('Error sending email:', error.response?.data || error.message);
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
 * Send Login OTP Email
 */
export const sendOTPEmail = async (email, code, context = 'Login') => {
  const subject = `Your Palm Merit ${context} Verification Code`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 10px;">
      <h2 style="color: #0A6847; text-align: center;">${context} Verification Code</h2>
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
