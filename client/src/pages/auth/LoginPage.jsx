import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import './Auth.css';

const LoginPage = () => {
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const { login, verifyOTP } = useAuth();
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCredentials({ ...credentials, [name]: value });
    setError('');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const data = await login(credentials.email, credentials.password);
      if (data.requiresOTP) {
        setOtpStep(true);
        if (data.mockOtp) setOtpCode(data.mockOtp);
      } else {
        if (data.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const data = await verifyOTP(credentials.email, otpCode);
      if (data.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Invalid OTP. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="container">
        <div className="auth-card">
          <div className="auth-header" style={{ textAlign: 'center' }}>
            <img src="/logo.png" alt="Palm Merit Logo" style={{ width: '120px', marginBottom: '20px' }} />
            <h2>Welcome Back</h2>
            <p>Sign in to your Palm Merit Global account</p>
          </div>

          {error && (
            <div className="auth-alert danger">
              {error}
            </div>
          )}

          {!otpStep ? (
            <form onSubmit={handleLoginSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={credentials.email}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter your email"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={credentials.password}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter your password"
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
              
              <div className="auth-actions">
                <Link to="/forgot-password" className="forgot-password">Forgot Password?</Link>
              </div>
              
              <Button type="submit" variant="primary" className="btn-block">
                {isLoading ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleOTPSubmit} className="auth-form">
              <div className="alert alert-info" style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e8f4fd', borderRadius: '8px' }}>
                <p>We've sent a 6-digit verification code to your email/phone.</p>
                {otpCode && <small style={{ color: 'green', display: 'block', marginTop: '10px' }}>Development mode auto-fill: {otpCode}</small>}
              </div>
              
              <div className="form-group">
                <label htmlFor="otpCode">Enter OTP Code</label>
                <input
                  type="text"
                  id="otpCode"
                  name="otpCode"
                  value={otpCode}
                  onChange={(e) => {
                    setOtpCode(e.target.value);
                    setError('');
                  }}
                  required
                  maxLength="6"
                  placeholder="------"
                  style={{ textAlign: 'center', letterSpacing: '5px', fontSize: '1.2rem', fontWeight: 'bold' }}
                />
              </div>
              
              <Button type="submit" variant="primary" className="btn-block">
                {isLoading ? 'Verifying...' : 'Verify & Continue'}
              </Button>
              
              <div style={{ textAlign: 'center', marginTop: '15px' }}>
                <button type="button" className="btn-link" onClick={() => setOtpStep(false)}>
                  Back to Login
                </button>
              </div>
            </form>
          )}

          <div className="auth-footer">
            <p>Don't have an account? <Link to="/register">Create Free Account</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
