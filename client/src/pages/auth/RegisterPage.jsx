import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import { auth } from '../../config/firebaseConfig';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import './Auth.css';

const RegisterPage = () => {
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    surname: '', middleName: '', firstName: '', dob: '', phone: '',
    address: '', nearestBusStop: '',
    nokName: '', nokRelationship: '', nokPhone: '',
    email: '', password: '', confirmPassword: '', referredByCode: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [verificationId, setVerificationId] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const setupRecaptcha = () => {
    // Always clear and recreate to avoid stale verifier state (-39 error fix)
    if (window.recaptchaVerifier) {
      try { window.recaptchaVerifier.clear(); } catch (_) {}
      window.recaptchaVerifier = null;
    }

    try {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: (response) => {
          // reCAPTCHA solved
        },
        'expired-callback': () => {
          setError('reCAPTCHA expired. Please try again.');
        }
      });
    } catch (err) {
      console.error("Recaptcha init error:", err);
    }
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const refCode = searchParams.get('ref');
    if (refCode) {
      setFormData(prev => ({ ...prev, referredByCode: refCode }));
    }
  }, [location]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setError('');
  };

  const validateStep = () => {
    if (step === 1) {
      if (!formData.surname || !formData.firstName || !formData.dob || !formData.phone) {
        setError("Please fill all required personal details.");
        return false;
      }
    } else if (step === 2) {
      if (!formData.address || !formData.nearestBusStop || !formData.nokName || !formData.nokRelationship || !formData.nokPhone) {
        setError("Please fill all address and next of kin details.");
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) {
      setStep(step + 1);
      setError('');
    }
  };

  const prevStep = () => {
    setStep(step - 1);
    setError('');
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

  const sendOtp = async (e) => {
    if (e) e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match!");
      return;
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);
    setError('');
    // Clear any previous OTP input when sending a new code
    setOtp('');

    try {
      setupRecaptcha();
      const appVerifier = window.recaptchaVerifier;
      
      let phoneNumber = formData.phone.trim();
      if (phoneNumber.startsWith('0')) {
        phoneNumber = '+234' + phoneNumber.substring(1);
      } else if (!phoneNumber.startsWith('+')) {
        phoneNumber = '+234' + phoneNumber;
      }

      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setVerificationId(confirmationResult);
      setStep(4);
      startResendCooldown();
    } catch (err) {
      console.error('Failed to send OTP:', err);
      // Clean up recaptcha to allow retries
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch (_) {}
        window.recaptchaVerifier = null;
      }
      if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait a few minutes and try again.');
      } else if (err.code === 'auth/invalid-phone-number') {
        setError('Invalid phone number. Please enter a valid Nigerian phone number.');
      } else if (err.code?.includes('-39') || err.message?.includes('-39') || err.message?.includes('39')) {
        setError('Firebase has flagged this sign-in attempt (Anti-Abuse/Rate Limit). For local development and testing, please register a Test Phone Number in your Firebase Console to bypass carrier limits.');
      } else {
        setError(err.message || 'Failed to send verification code. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError('');
    setOtp('');
    await sendOtp();
  };

  const verifyOtpAndRegister = async (e) => {
    e.preventDefault();
    const trimmedOtp = otp.trim();
    if (!trimmedOtp || trimmedOtp.length < 6) {
      setError('Please enter the 6-digit OTP');
      return;
    }

    if (!verificationId) {
      setError('Verification session expired. Please go back and request a new code.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await verificationId.confirm(trimmedOtp);
      const firebaseToken = await result.user.getIdToken();
      await register({
        firstName: formData.firstName,
        lastName: formData.surname,
        middleName: formData.middleName,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        dob: formData.dob,
        address: formData.address,
        nearestBusStop: formData.nearestBusStop,
        nokName: formData.nokName,
        nokRelationship: formData.nokRelationship,
        nokPhone: formData.nokPhone,
        referredByCode: formData.referredByCode,
        firebaseToken,
      });
      navigate('/dashboard');
    } catch (err) {
      console.error('Registration error:', err);
      if (err.code === 'auth/invalid-verification-code') {
        setError('Invalid verification code. Please double-check the code and try again, or resend a new one.');
      } else if (err.code === 'auth/code-expired') {
        setError('Verification code has expired. Please resend a new code.');
        setVerificationId(null);
      } else if (err.code === 'auth/session-expired') {
        setError('Verification session expired. Please resend a new code.');
        setVerificationId(null);
      } else {
        const message = err.response?.data?.message || err.message || 'Registration failed. Please try again.';
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="container">
        <div className="auth-card register-card">
          <div className="auth-header" style={{ textAlign: 'center' }}>
            <img src="/logo.png" alt="Palm Merit Logo" style={{ width: '100px', marginBottom: '15px' }} />
            <h2>Create Account</h2>
            <p>Join the cooperative and start your journey</p>
          </div>

          <div className="progress-indicator">
            <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>1</div>
            <div className={`progress-line ${step >= 2 ? 'active' : ''}`}></div>
            <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>2</div>
            <div className={`progress-line ${step >= 3 ? 'active' : ''}`}></div>
            <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>3</div>
            <div className={`progress-line ${step >= 4 ? 'active' : ''}`}></div>
            <div className={`progress-step ${step >= 4 ? 'active' : ''}`}>4</div>
          </div>

          {error && (
            <div className="auth-alert danger">
              {error}
            </div>
          )}

          <form onSubmit={step === 4 ? verifyOtpAndRegister : step === 3 ? sendOtp : (e) => { e.preventDefault(); nextStep(); }} className="auth-form">
            <div id="recaptcha-container"></div>

            {/* ─── Step 1: Personal Info ─── */}
            {step === 1 && (
              <div className="form-section fade-in">
                <h3>Personal Information</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Surname</label>
                    <input type="text" name="surname" value={formData.surname} onChange={handleInputChange} placeholder="e.g. Adebayo" required />
                  </div>
                  <div className="form-group">
                    <label>First Name</label>
                    <input type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} placeholder="e.g. John" required />
                  </div>
                  <div className="form-group">
                    <label>Middle Name</label>
                    <input type="text" name="middleName" value={formData.middleName} onChange={handleInputChange} placeholder="Optional" />
                  </div>
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input type="date" name="dob" value={formData.dob} onChange={handleInputChange} required />
                  </div>
                  <div className="form-group full-width">
                    <label>Phone Number</label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="08012345678" required autoComplete="off" />
                  </div>
                </div>
                <Button type="submit" variant="primary" className="btn-block mt-4">Next: Address Details</Button>
              </div>
            )}

            {/* ─── Step 2: Address & Next of Kin ─── */}
            {step === 2 && (
              <div className="form-section fade-in">
                <h3>Address &amp; Next of Kin</h3>
                <div className="form-group full-width">
                  <label>Residential Address</label>
                  <textarea name="address" value={formData.address} onChange={handleInputChange} required rows="2" placeholder="Enter your full street address"></textarea>
                </div>
                <div className="form-group full-width">
                  <label>Nearest Bus Stop</label>
                  <input type="text" name="nearestBusStop" value={formData.nearestBusStop} onChange={handleInputChange} required placeholder="e.g. Ojota Bus Stop" />
                </div>

                <h4 className="mt-4 mb-2">Next of Kin Details</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Full Name</label>
                    <input type="text" name="nokName" value={formData.nokName} onChange={handleInputChange} required placeholder="NOK Full Name" />
                  </div>
                  <div className="form-group">
                    <label>Relationship</label>
                    <input type="text" name="nokRelationship" value={formData.nokRelationship} onChange={handleInputChange} required placeholder="e.g. Brother, Spouse" />
                  </div>
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input type="tel" name="nokPhone" value={formData.nokPhone} onChange={handleInputChange} required placeholder="NOK Phone Number" autoComplete="off" />
                  </div>
                </div>

                <div className="form-actions mt-4">
                  <Button type="button" variant="outline" onClick={prevStep}>Back</Button>
                  <Button type="submit" variant="primary">Next: Account Security</Button>
                </div>
              </div>
            )}

            {/* ─── Step 3: Credentials ─── */}
            {step === 3 && (
              <div className="form-section fade-in">
                <h3>Account Credentials</h3>
                <div className="form-group full-width">
                  <label>Email Address (Optional)</label>
                  <input type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="name@example.com" autoComplete="off" />
                </div>
                <div className="form-group full-width">
                  <label>Password</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password" value={formData.password} onChange={handleInputChange} required
                      placeholder="At least 6 characters" autoComplete="new-password"
                    />
                    <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                </div>
                <div className="form-group full-width">
                  <label>Confirm Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} required
                    placeholder="Repeat your password" autoComplete="new-password"
                  />
                </div>
                <div className="form-group full-width">
                  <label>Referral Code (Optional)</label>
                  <input type="text" name="referredByCode" value={formData.referredByCode || ''} onChange={handleInputChange} placeholder="e.g. CKO-72841" autoComplete="off" />
                </div>

                <div className="auth-alert warning mt-3">
                  <small>
                    By clicking Complete Registration, you confirm that you have read and accepted our{' '}
                    <Link to="/terms" target="_blank" style={{ textDecoration: 'underline', color: 'inherit', fontWeight: 'bold' }}>Terms &amp; Conditions</Link>.
                    Registration fees are non-refundable.
                  </small>
                </div>

                <div className="form-actions mt-4">
                  <Button type="button" variant="outline" onClick={prevStep}>Back</Button>
                  <Button type="submit" variant="accent" disabled={isLoading}>
                    {isLoading ? 'Sending Code...' : 'Next: Verify Phone'}
                  </Button>
                </div>
              </div>
            )}

            {/* ─── Step 4: Verify Phone ─── */}
            {step === 4 && (
              <div className="form-section fade-in">
                <h3>Verify Phone Number</h3>
                <p>We've sent a 6-digit verification code to <strong>{formData.phone}</strong>.</p>
                <div className="form-group full-width mt-3">
                  <label>Verification Code</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={otp} 
                    onChange={(e) => { 
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setOtp(val); 
                      setError(''); 
                    }} 
                    placeholder="Enter 6-digit code" 
                    required 
                    maxLength="6"
                    autoComplete="one-time-code"
                  />
                </div>

                <div style={{ textAlign: 'center', margin: '10px 0' }}>
                  <button 
                    type="button" 
                    onClick={handleResendOtp} 
                    disabled={resendCooldown > 0 || isLoading}
                    style={{ 
                      background: 'none', border: 'none', color: resendCooldown > 0 ? '#999' : 'var(--color-primary)', 
                      cursor: resendCooldown > 0 ? 'default' : 'pointer', textDecoration: 'underline', fontSize: '0.9rem' 
                    }}
                  >
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend verification code'}
                  </button>
                </div>
                
                <div className="form-actions mt-4">
                  <Button type="button" variant="outline" onClick={() => { setStep(3); setOtp(''); setError(''); setVerificationId(null); }}>Back</Button>
                  <Button type="submit" variant="accent" disabled={isLoading}>
                    {isLoading ? 'Verifying...' : 'Complete Registration'}
                  </Button>
                </div>
              </div>
            )}
          </form>

          <div className="auth-footer mt-4">
            <p>Already have an account? <Link to="/login">Sign In</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
