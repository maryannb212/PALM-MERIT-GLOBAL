import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { forgotPassword, resetPassword } from '../../services/api';
import './Auth.css';

const ForgotPasswordPage = () => {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [step, setStep] = useState(1); // 1=phone, 2=otp+new password
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [mockOtp, setMockOtp] = useState('');
  const navigate = useNavigate();

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
    setMockOtp('');

    try {
      const { data } = await forgotPassword({ phone: phone.trim() });
      setMessage({ type: 'success', text: data.message || 'OTP sent successfully! Check your phone.' });
      if (data.mockOtp) {
        setMockOtp(data.mockOtp);
        setOtp(data.mockOtp);
      }
      setStep(2);
      startResendCooldown();
    } catch (err) {
      const text = err.response?.data?.message || 'Failed to send OTP. Please try again.';
      setMessage({ type: 'error', text });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;
    setMessage({ type: '', text: '' });
    setOtp('');
    setMockOtp('');
    await handleSendOTP();
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    const trimmedOtp = otp.trim();
    if (!trimmedOtp || trimmedOtp.length < 6) {
      setMessage({ type: 'error', text: 'Please enter the 6-digit code.' });
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      setLoading(false);
      return;
    }

    try {
      const { data } = await resetPassword({ 
        phone: phone.trim(), 
        otp: trimmedOtp, 
        password: newPassword 
      });
      setMessage({ type: 'success', text: data.message || 'Password reset successful!' });
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      const text = err.response?.data?.message || 'Failed to reset password. Please try again.';
      setMessage({ type: 'error', text });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header" style={{ textAlign: 'center' }}>
          <img src="/logo.png" alt="Palm Merit Logo" style={{ width: '100px', marginBottom: '15px' }} />
          <h2>Forgot Password</h2>
          <p>
            {step === 1
              ? 'Enter your registered phone number to receive an OTP.'
              : 'Enter the OTP and your new password.'}
          </p>
        </div>

        {message.text && (
          <div className={`auth-alert ${message.type}`}>
            {message.text}
          </div>
        )}

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
          <form onSubmit={handleResetPassword} className="auth-form">
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
                style={{ textAlign: 'center', letterSpacing: '5px', fontSize: '1.1rem', fontWeight: 'bold' }}
              />
              {mockOtp && (
                <small style={{ color: 'green', display: 'block', marginTop: '5px' }}>
                  Dev mode auto-fill: {mockOtp}
                </small>
              )}
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

            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                />
                <button 
                  type="button" 
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary full-width" disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '15px' }}>
              <button 
                type="button" 
                className="btn-link" 
                onClick={() => { setStep(1); setMessage({ type: '', text: '' }); }}
                style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }}
              >
                ← Change phone number
              </button>
            </div>
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
