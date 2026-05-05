import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUniversity, FaChevronLeft, FaSave, FaCheckCircle, FaSearch, FaSpinner } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { saveBankDetails, resolveBank } from '../../services/api';

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

const BankDetails = () => {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  const [formData, setFormData] = useState({
    accountName: user?.bankDetails?.accountName || '',
    accountNumber: user?.bankDetails?.accountNumber || '',
    bankName: user?.bankDetails?.bankName || '',
    bankCode: user?.bankDetails?.bankCode || ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleBankChange = (e) => {
    const selectedBank = NIGERIAN_BANKS.find(b => b.code === e.target.value);
    setFormData({ 
      ...formData, 
      bankCode: selectedBank?.code || '',
      bankName: selectedBank?.name || ''
    });
  };

  const resolveAccount = async () => {
    if (formData.accountNumber.length !== 10 || !formData.bankCode) return;
    
    setResolving(true);
    setMessage({ text: '', type: '' });
    
    try {
      const { data } = await resolveBank(formData.accountNumber, formData.bankCode);
      setFormData({ ...formData, accountName: data.account_name });
      setMessage({ text: `Account resolved: ${data.account_name}`, type: 'success' });
    } catch (err) {
      setMessage({ text: 'Could not resolve account. Please type name manually.', type: 'error' });
    } finally {
      setResolving(false);
    }
  };

  // Auto-resolve when 10 digits are reached
  useEffect(() => {
    if (formData.accountNumber.length === 10 && formData.bankCode) {
      resolveAccount();
    }
  }, [formData.accountNumber, formData.bankCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.accountNumber.length !== 10) {
      setMessage({ text: 'Account number must be 10 digits', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      await saveBankDetails(formData);
      await refreshProfile();
      setMessage({ text: 'Bank details saved successfully!', type: 'success' });
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Failed to save bank details.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
        <header className="dashboard-header">
          <div className="header-title">
            <button className="btn-icon-only" onClick={() => navigate('/dashboard')}>
              <FaChevronLeft />
            </button>
            <h2>Withdrawal Bank Account</h2>
          </div>
        </header>

        <div className="bank-details-card card max-width-600 mx-auto mt-4">
          <div className="card-header text-center p-4">
            <FaUniversity size={40} color="var(--color-primary)" />
            <h3 className="mt-2">Settlement Account</h3>
            <p className="text-muted">Funds will be sent to this account upon withdrawal approval.</p>
          </div>

          <form onSubmit={handleSubmit} className="p-4 pt-0">
            <div className="form-group">
              <label>Select Bank</label>
              <select 
                name="bankCode" 
                value={formData.bankCode} 
                onChange={handleBankChange} 
                required
              >
                <option value="">Select Bank...</option>
                {NIGERIAN_BANKS.map(bank => (
                  <option key={bank.code} value={bank.code}>{bank.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Account Number (10 Digits)</label>
              <div className="input-with-action">
                <input 
                  type="text" 
                  name="accountNumber" 
                  value={formData.accountNumber} 
                  onChange={handleInputChange} 
                  maxLength="10" 
                  placeholder="0123456789" 
                  required 
                />
                {resolving && <FaSpinner className="spin" />}
              </div>
            </div>

            <div className="form-group">
              <label>Account Name</label>
              <input 
                type="text" 
                name="accountName" 
                value={formData.accountName} 
                onChange={handleInputChange} 
                placeholder="Auto-resolved or type manually" 
                required 
              />
            </div>

            {message.text && (
              <div className={`form-message ${message.type === 'success' ? 'success' : 'error'} mb-3`}>
                {message.type === 'success' ? <FaCheckCircle /> : null} {message.text}
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-block" disabled={loading || resolving}>
              {loading ? 'Saving...' : 'Save Bank Details'}
            </button>
          </form>
        </div>
    </>
  );
};

export default BankDetails;
