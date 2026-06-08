import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
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
    nokName: '', nokRelationship: '', nokPhone: '', nokAddress: '', nokDob: '',
    email: '', password: '', confirmPassword: '', referredByCode: ''
  });
  const [showPassword, setShowPassword] = useState(false);

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

  const handleDirectRegister = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Direct registration call with user data
      await register({
        firstName: formData.firstName,
        lastName: formData.surname,
        middleName: formData.middleName,
        dob: formData.dob,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        address: formData.address,
        nearestBusStop: formData.nearestBusStop,
        nokName: formData.nokName,
        nokRelationship: formData.nokRelationship,
        nokPhone: formData.nokPhone,
        referredByCode: formData.referredByCode
      });
      
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.message || err.message || 'Registration failed. Please try again.';
      setError(message);
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
          </div>

          {error && (
            <div className="auth-alert danger">
              {error}
            </div>
          )}

          <form onSubmit={step === 3 ? handleDirectRegister : (e) => { e.preventDefault(); nextStep(); }} className="auth-form">
            
            {step === 1 && (
              <div className="form-section fade-in">
                <h3>Personal Information</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Surname</label>
                    <input 
                      type="text" name="surname" value={formData.surname} onChange={handleInputChange} 
                      placeholder="e.g. Adebayo" required 
                    />
                  </div>
                  <div className="form-group">
                    <label>First Name</label>
                    <input 
                      type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} 
                      placeholder="e.g. John" required 
                    />
                  </div>
                  <div className="form-group">
                    <label>Middle Name</label>
                    <input 
                      type="text" name="middleName" value={formData.middleName} onChange={handleInputChange} 
                      placeholder="Optional"
                    />
                  </div>
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input 
                      type="date" name="dob" value={formData.dob} onChange={handleInputChange} required 
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Phone Number</label>
                    <input 
                      type="tel" name="phone" value={formData.phone} onChange={handleInputChange} 
                      placeholder="08012345678" required 
                      autoComplete="off"
                    />
                  </div>
                </div>
                <Button type="submit" variant="primary" className="btn-block mt-4">Next: Address Details</Button>
              </div>
            )}

            {step === 2 && (
              <div className="form-section fade-in">
                <h3>Address & Next of Kin</h3>
                <div className="form-group full-width">
                  <label>Residential Address</label>
                  <textarea 
                    name="address" value={formData.address} onChange={handleInputChange} required rows="2"
                    placeholder="Enter your full street address"
                  ></textarea>
                </div>
                <div className="form-group full-width">
                  <label>Nearest Bus Stop</label>
                  <input 
                    type="text" name="nearestBusStop" value={formData.nearestBusStop} onChange={handleInputChange} required 
                    placeholder="e.g. Ojota Bus Stop"
                  />
                </div>
                
                <h4 className="mt-4 mb-2">Next of Kin Details</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Full Name</label>
                    <input 
                      type="text" name="nokName" value={formData.nokName} onChange={handleInputChange} required 
                      placeholder="NOK Full Name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Relationship</label>
                    <input 
                      type="text" name="nokRelationship" value={formData.nokRelationship} onChange={handleInputChange} required 
                      placeholder="e.g. Brother, Spouse"
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input 
                      type="tel" name="nokPhone" value={formData.nokPhone} onChange={handleInputChange} required 
                      placeholder="NOK Phone Number"
                      autoComplete="off"
                    />
                  </div>
                </div>
                
                <div className="form-actions mt-4">
                  <Button type="button" variant="outline" onClick={prevStep}>Back</Button>
                  <Button type="submit" variant="primary">Next: Account Security</Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="form-section fade-in">
                <h3>Account Credentials</h3>
                <div className="form-group full-width">
                  <label>Email Address (Optional)</label>
                  <input 
                    type="email" name="email" value={formData.email} onChange={handleInputChange} 
                    placeholder="name@example.com"
                    autoComplete="off"
                  />
                </div>
                <div className="form-group full-width">
                  <label>Password</label>
                  <div className="password-input-wrapper">
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      name="password" value={formData.password} onChange={handleInputChange} required 
                      placeholder="At least 6 characters"
                      autoComplete="new-password"
                    />
                    <button 
                      type="button" className="password-toggle" 
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                </div>
                <div className="form-group full-width">
                  <label>Confirm Password</label>
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} required 
                    placeholder="Repeat your password"
                    autoComplete="new-password"
                  />
                </div>

                <div className="form-group full-width">
                  <label>Referred By / Upline Code (Optional)</label>
                  <input 
                    type="text" 
                    name="referredByCode" 
                    value={formData.referredByCode || ''} 
                    onChange={handleInputChange} 
                    placeholder="e.g. CKO-72841"
                    autoComplete="off"
                  />
                </div>
                
                <div className="auth-alert warning mt-3">
                  <small>
                    By clicking Complete Registration, you confirm that you have read and accepted our 
                    <Link to="/terms" target="_blank" style={{ textDecoration: 'underline', color: 'inherit', fontWeight: 'bold' }}> Terms & Conditions</Link>. 
                    Registration fees are non-refundable.
                  </small>
                </div>
                
                <div className="form-actions mt-4">
                  <Button type="button" variant="outline" onClick={prevStep}>Back</Button>
                  <Button type="submit" variant="accent" disabled={isLoading}>
                    {isLoading ? 'Creating Account...' : 'Complete Registration'}
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
