import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUpload, FaChevronLeft, FaSave, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { submitKYC } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

import './Dashboard.css';

const NIGERIAN_BANKS = [
  { name: 'Access Bank', code: '044' },
  { name: 'Fidelity Bank', code: '070' },
  { name: 'First Bank of Nigeria', code: '011' },
  { name: 'First City Monument Bank (FCMB)', code: '214' },
  { name: 'Guaranty Trust Bank (GTBank)', code: '058' },
  { name: 'Heritage Bank', code: '030' },
  { name: 'Keystone Bank', code: '082' },
  { name: 'Stanbic IBTC Bank', code: '221' },
  { name: 'Sterling Bank', code: '232' },
  { name: 'Union Bank of Nigeria', code: '032' },
  { name: 'United Bank for Africa (UBA)', code: '033' },
  { name: 'Unity Bank', code: '215' },
  { name: 'Wema Bank', code: '035' },
  { name: 'Zenith Bank', code: '057' },
  { name: 'Kuda Bank', code: '50211' },
  { name: 'Opay', code: '999992' },
  { name: 'Palmpay', code: '999991' },
  { name: 'Moniepoint', code: '50515' }
].sort((a, b) => a.name.localeCompare(b.name));

const KYC = () => {
  const navigate = useNavigate();
  const { user, updateUser, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    phone: '',
    email: '',
    address: '',
    gender: '',
    date_of_birth: '',
    bvn: '',
    bankName: '',
    bankCode: '',
    accountNumber: '',
    id_type: '',
    id_number: '',
  });

  const [files, setFiles] = useState({
    id_image: null,
    idBack: null,
    selfie: null,
    profile_image: null
  });

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        middleName: user.middleName || '',
        phone: user.phone || '',
        email: user.email || '',
        address: user.address || '',
        gender: user.gender || '',
        date_of_birth: user.dob ? user.dob.split('T')[0] : '',
        bvn: user.bvn || '',
        bankName: user.bankDetails?.bankName || '',
        bankCode: user.bankDetails?.bankCode || '',
        accountNumber: user.bankDetails?.accountNumber || '',
        id_type: user.id_type || '',
        id_number: user.id_number || '',
      });
    }
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'date_of_birth') {
      const cleaned = value.replace(/[^0-9-]/g, '').slice(0, 10);
      setFormData({ ...formData, [name]: cleaned });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleBankChange = (e) => {
    const selectedBank = NIGERIAN_BANKS.find(b => b.code === e.target.value);
    setFormData({ 
      ...formData, 
      bankCode: selectedBank?.code || '',
      bankName: selectedBank?.name || ''
    });
  };

  const handleFileChange = (e) => {
    const { name, files: uploadedFiles } = e.target;
    if (uploadedFiles[0]) {
      setFiles({ ...files, [name]: uploadedFiles[0] });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (user?.kycStatus !== 'verified' && step < 3) {
      setStep(step + 1);
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const data = new FormData();
      // Append text fields
      Object.keys(formData).forEach(key => data.append(key, formData[key]));
      // Append files
      if (files.id_image) data.append('id_image', files.id_image);
      if (files.idBack) data.append('idBack', files.idBack);
      if (files.selfie) data.append('selfie', files.selfie);
      if (files.profile_image) data.append('profile_image', files.profile_image);

      const response = await submitKYC(data);
      await refreshProfile();
      setMessage({ 
        text: user?.kycStatus === 'verified' ? 'Profile updated successfully!' : 'KYC submitted successfully! Pending review.', 
        type: 'success' 
      });
      if (user?.kycStatus !== 'verified') {
        setTimeout(() => navigate('/dashboard'), 3000);
      }
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Failed to update profile details.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (user?.kycStatus === 'pending') {
    return (
      <>
          <div className="status-screen card text-center p-xxl">
            <FaCheckCircle size={60} color="var(--color-primary)" />
            <h2 className="mt-3">KYC Verification Pending</h2>
            <p className="mt-2 text-muted">Your documents have been submitted and are currently under review. This usually takes 24-48 hours.</p>
            <button className="btn btn-primary mt-4" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
          </div>
      </>
    );
  }

  return (
    <>
        <header className="dashboard-header">
          <div className="header-title">
            <button className="btn-icon-only" onClick={() => navigate('/dashboard')}>
              <FaChevronLeft />
            </button>
            <h2>{user?.kycStatus === 'verified' ? 'Profile & Account Settings' : 'Know Your Customer (KYC)'}</h2>
          </div>
        </header>

        {user?.kycStatus === 'verified' ? (
          <div className="kyc-wizard card">
            <div className="kyc-verified-header" style={{ display: 'flex', alignItems: 'center', gap: '15px', background: '#d4edda', color: '#155724', padding: '20px', borderRadius: '12px', marginBottom: '30px', border: '1px solid #c3e6cb' }}>
              <FaCheckCircle size={32} color="#28a745" />
              <div>
                <h3 style={{ margin: 0, fontWeight: 'bold', fontSize: '1.25rem', color: '#155724' }}>KYC Approved & Verified</h3>
                <p style={{ margin: '5px 0 0 0', fontSize: '0.92rem', opacity: 0.9 }}>Your identity and billing details have been successfully verified. You can update your profile details and photo below at any time.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="kyc-full-form">
              <section className="form-section">
                <h3>Basic Information</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Last Name</label>
                    <input type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} required />
                  </div>
                  <div className="form-group">
                    <label>First Name</label>
                    <input type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} required />
                  </div>
                  <div className="form-group">
                    <label>Middle Name</label>
                    <input type="text" name="middleName" value={formData.middleName} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input 
                      type="text" 
                      name="date_of_birth" 
                      placeholder="YYYY-MM-DD" 
                      value={formData.date_of_birth} 
                      onChange={handleInputChange} 
                      required 
                      style={{ letterSpacing: '1px' }}
                    />
                    <span className="text-muted" style={{ fontSize: '0.72rem', marginTop: '4px', display: 'block' }}>Format: YYYY-MM-DD (e.g. 1995-08-24)</span>
                  </div>
                  <div className="form-group">
                    <label>Gender</label>
                    <select name="gender" value={formData.gender} onChange={handleInputChange} required>
                      <option value="">Select...</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                  <div className="form-group full-width">
                    <label>Residential Address</label>
                    <textarea name="address" value={formData.address} onChange={handleInputChange} rows="2" required></textarea>
                  </div>
                </div>
              </section>

              <section className="form-section mt-4">
                <h3>Identity & Banking Details</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>ID Type</label>
                    <select name="id_type" value={formData.id_type} onChange={handleInputChange} required>
                      <option value="">Select ID Type...</option>
                      <option value="NIN">NIN</option>
                      <option value="Voter Card">Voter Card</option>
                      <option value="Driver License">Driver's License</option>
                      <option value="Passport">International Passport</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>ID Number</label>
                    <input type="text" name="id_number" value={formData.id_number} onChange={handleInputChange} required />
                  </div>
                  <div className="form-group full-width">
                    <label>Bank Verification Number (BVN)</label>
                    <input type="text" name="bvn" value={formData.bvn} onChange={handleInputChange} maxLength="11" required />
                  </div>
                  <div className="form-group">
                    <label>Preferred Bank</label>
                    <select name="bankCode" value={formData.bankCode} onChange={handleBankChange}>
                      <option value="">Select Bank...</option>
                      {NIGERIAN_BANKS.map(bank => (
                        <option key={bank.code} value={bank.code}>{bank.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Account Number</label>
                    <input type="text" name="accountNumber" value={formData.accountNumber} onChange={handleInputChange} maxLength="10" />
                  </div>
                </div>
              </section>

              <section className="form-section mt-4">
                <h3>Update Profile Photo <span className="text-muted">(Optional)</span></h3>
                <p className="text-muted mb-4">You may update your profile photo below. To prevent security fraud, verified KYC documents cannot be uploaded again.</p>
                
                <div className="upload-grid" style={{ gridTemplateColumns: '1fr' }}>
                  <div className="upload-box" style={{ maxWidth: '300px' }}>
                    <label>Profile Photo</label>
                    <div className="file-input-wrapper">
                      <FaUpload /> {files.profile_image ? files.profile_image.name : 'Choose Image'}
                      <input type="file" name="profile_image" onChange={handleFileChange} accept="image/*" />
                    </div>
                  </div>
                </div>
              </section>

              {message.text && (
                <div className={`form-message ${message.type === 'success' ? 'success' : 'error'}`}>
                  {message.type === 'error' ? <FaExclamationTriangle /> : <FaCheckCircle />} {message.text}
                </div>
              )}

              <div className="form-actions-footer">
                <button type="button" className="btn btn-outline" onClick={() => navigate('/dashboard')}>Cancel</button>
                <button type="submit" className="btn btn-accent" disabled={loading}>
                  <FaSave /> {loading ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="kyc-wizard card">
            <div className="wizard-steps">
              <div className={`wizard-step ${step >= 1 ? 'active' : ''}`}>1. Personal</div>
              <div className={`wizard-step ${step >= 2 ? 'active' : ''}`}>2. Identification</div>
              <div className={`wizard-step ${step >= 3 ? 'active' : ''}`}>3. Documents</div>
            </div>

            <form onSubmit={handleSubmit} className="kyc-full-form">
              {step === 1 && (
                <div className="fade-in">
                  <section className="form-section">
                    <h3>Basic Information</h3>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Last Name</label>
                        <input type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} required />
                      </div>
                      <div className="form-group">
                        <label>First Name</label>
                        <input type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} required />
                      </div>
                      <div className="form-group">
                        <label>Middle Name</label>
                        <input type="text" name="middleName" value={formData.middleName} onChange={handleInputChange} />
                      </div>
                      <div className="form-group">
                        <label>Date of Birth</label>
                        <input 
                          type="text" 
                          name="date_of_birth" 
                          placeholder="YYYY-MM-DD" 
                          value={formData.date_of_birth} 
                          onChange={handleInputChange} 
                          required 
                          style={{ letterSpacing: '1px' }}
                        />
                        <span className="text-muted" style={{ fontSize: '0.72rem', marginTop: '4px', display: 'block' }}>Format: YYYY-MM-DD (e.g. 1995-08-24)</span>
                      </div>
                      <div className="form-group">
                        <label>Gender</label>
                        <select name="gender" value={formData.gender} onChange={handleInputChange} required>
                          <option value="">Select...</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                      </div>
                      <div className="form-group full-width">
                        <label>Residential Address</label>
                        <textarea name="address" value={formData.address} onChange={handleInputChange} rows="2" required></textarea>
                      </div>
                    </div>
                  </section>
                  <div className="form-actions-footer">
                    <button type="button" className="btn btn-primary" onClick={() => setStep(2)}>Next Step</button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="fade-in">
                  <section className="form-section">
                    <h3>Identity & Banking</h3>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>ID Type</label>
                        <select name="id_type" value={formData.id_type} onChange={handleInputChange} required>
                          <option value="">Select ID Type...</option>
                          <option value="NIN">NIN</option>
                          <option value="Voter Card">Voter Card</option>
                          <option value="Driver License">Driver's License</option>
                          <option value="Passport">International Passport</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>ID Number</label>
                        <input type="text" name="id_number" value={formData.id_number} onChange={handleInputChange} required />
                      </div>
                      <div className="form-group full-width">
                        <label>Bank Verification Number (BVN)</label>
                        <input type="text" name="bvn" value={formData.bvn} onChange={handleInputChange} maxLength="11" required />
                      </div>
                      <div className="form-group">
                        <label>Preferred Bank</label>
                        <select name="bankCode" value={formData.bankCode} onChange={handleBankChange}>
                          <option value="">Select Bank...</option>
                          {NIGERIAN_BANKS.map(bank => (
                            <option key={bank.code} value={bank.code}>{bank.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Account Number</label>
                        <input type="text" name="accountNumber" value={formData.accountNumber} onChange={handleInputChange} maxLength="10" />
                      </div>
                    </div>
                  </section>
                  <div className="form-actions-footer">
                    <button type="button" className="btn btn-outline" onClick={() => setStep(1)}>Back</button>
                    <button type="button" className="btn btn-primary" onClick={() => setStep(3)}>Next Step</button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="fade-in">
                  <section className="form-section">
                    <h3>Document Uploads</h3>
                    <p className="text-muted mb-4">Please upload clear images of your documents (Max 5MB per file).</p>
                    
                    <div className="upload-grid">
                      <div className="upload-box">
                        <label>ID Card (Front)</label>
                        <div className="file-input-wrapper">
                          <FaUpload /> {files.id_image ? files.id_image.name : 'Choose Image'}
                          <input type="file" name="id_image" onChange={handleFileChange} accept="image/*" required />
                        </div>
                      </div>
                      <div className="upload-box">
                        <label>ID Card (Back)</label>
                        <div className="file-input-wrapper">
                          <FaUpload /> {files.idBack ? files.idBack.name : 'Choose Image'}
                          <input type="file" name="idBack" onChange={handleFileChange} accept="image/*" />
                        </div>
                      </div>
                      <div className="upload-box">
                        <label>Selfie (Holding ID)</label>
                        <div className="file-input-wrapper">
                          <FaUpload /> {files.selfie ? files.selfie.name : 'Choose Image'}
                          <input type="file" name="selfie" onChange={handleFileChange} accept="image/*" required />
                        </div>
                      </div>
                      <div className="upload-box">
                        <label>Profile Photo <span className="text-muted">(Optional)</span></label>
                        <div className="file-input-wrapper">
                          <FaUpload /> {files.profile_image ? files.profile_image.name : 'Choose Image'}
                          <input type="file" name="profile_image" onChange={handleFileChange} accept="image/*" />
                        </div>
                      </div>
                    </div>
                  </section>

                  {message.text && (
                    <div className={`form-message ${message.type === 'success' ? 'success' : 'error'}`}>
                      {message.type === 'error' ? <FaExclamationTriangle /> : <FaCheckCircle />} {message.text}
                    </div>
                  )}

                  <div className="form-actions-footer">
                    <button type="button" className="btn btn-outline" onClick={() => setStep(2)}>Back</button>
                    <button type="submit" className="btn btn-accent" disabled={loading}>
                      {loading ? 'Submitting...' : 'Complete & Submit'}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        )}
    </>
  );
};

export default KYC;
