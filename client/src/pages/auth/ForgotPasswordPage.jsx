import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../../config/firebaseConfig';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import './Auth.css';

const ForgotPasswordPage = () => {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const navigate = useNavigate();

  const setupRecaptcha = () => {
    if (window.recaptchaVerifier) {
      try { window.recaptchaVerifier.clear(); } catch (_) {}
      window.recaptchaVerifier = null;
    }
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      'size': 'invisible',
      'callback': () => {},
      'expired-callback': () => { window.recaptchaVerifier = null; }
    });
    return window.recaptchaVerifier;
  };

  const startResendCooldown = () => {
    setResendCooldown(60);
    const timer = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOTP = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });
    setOtp('');

    try {
      const appVerifier = setupRecaptcha();
      
      let formattedPhone = phone.trim();
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '+234' + formattedPhone.substring(1);
      } else if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+234' + formattedPhone;
      }

      const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      window.confirmationResult = confirmationResult;
      setMessage({ type: 'success', text: 'OTP sent successfully! Check your phone.' });
      setStep(2);
      startResendCooldown();
    } catch (err) {
      console.error('Firebase OTP error:', err);
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch (_) {}
        window.recaptchaVerifier = null;
      }
      const text = err.code === 'auth/too-many-requests'
        ? 'Too many attempts. Please wait a few minutes and try again.'
        : err.code === 'auth/invalid-phone-number'
        ? 'Invalid phone number. Please use a valid Nigerian number.'
        : 'Failed to send OTP. Please try again.';
      setMessage({ type: 'error', text });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;
    setMessage({ type: '', text: '' });
    setOtp('');
    await handleSendOTP();
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    const trimmedOtp = otp.trim();
    if (!trimmedOtp || trimmedOtp.length < 6) {
      setMessage({ type: 'error', text: 'Please enter the 6-digit code.' });
      setLoading(false);
      return;
    }

    if (!window.confirmationResult) {
      setMessage({ type: 'error', text: 'Verification session expired. Please request a new code.' });
      setLoading(false);
      setStep(1);
      return;
    }

    try {
      const result = await window.confirmationResult.confirm(trimmedOtp);
      const firebaseToken = await result.user.getIdToken();
      
      // Navigate to reset password page with the token via state (not URL to avoid truncation)
      navigate('/reset-password', { state: { token: firebaseToken } });
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/invalid-verification-code') {
        setMessage({ type: 'error', text: 'Invalid verification code. Please double-check and try again, or resend a new code.' });
      } else if (err.code === 'auth/code-expired' || err.code === 'auth/session-expired') {
        setMessage({ type: 'error', text: 'Verification code has expired. Please resend a new code.' });
        window.confirmationResult = null;
      } else {
        setMessage({ type: 'error', text: 'Invalid or expired OTP. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h2>Forgot Password</h2>
          <p>Enter your phone number to receive an OTP to reset your password.</p>
        </div>

        {message.text && (
          <div className={`auth-alert ${message.type}`}>
            {message.text}
          </div>
        )}

        <div id="recaptcha-container"></div>

        {step === 1 ? (
          <form onSubmit={handleSendOTP} className="auth-form">
            <div className="form-group">
              <label htmlFor="phone">Phone Number</label>
              <input
                type="tel"
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 08012345678"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary full-width" disabled={loading}>
              {loading ? 'Sending OTP...' : 'Send Reset OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="auth-form">
            <div className="form-group">
              <label htmlFor="otp">Verification Code</label>
              <input
                type="text"
                id="otp"
                inputMode="numeric"
                pattern="[0-9]*"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Enter 6-digit code"
                required
                maxLength="6"
                autoComplete="one-time-code"
              />
            </div>

            <div style={{ textAlign: 'center', margin: '10px 0' }}>
              <button 
                type="button" 
                onClick={handleResendOTP} 
                disabled={resendCooldown > 0 || loading}
                style={{ 
                  background: 'none', border: 'none', color: resendCooldown > 0 ? '#999' : 'var(--color-primary)', 
                  cursor: resendCooldown > 0 ? 'default' : 'pointer', textDecoration: 'underline', fontSize: '0.9rem' 
                }}
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend verification code'}
              </button>
            </div>

            <button type="submit" className="btn btn-primary full-width" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <p>Remembered your password? <Link to="/login">Back to Login</Link></p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
