import React, { useState } from 'react';
import { requestWithdrawal } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './DepositModal.css';

const WithdrawModal = ({ isOpen, onClose, availableBalance, onSuccess }) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [bankDetails, setBankDetails] = useState({
    accountName: user?.bankDetails?.accountName || '',
    accountNumber: user?.bankDetails?.accountNumber || '',
    bankName: user?.bankDetails?.bankName || ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) < 500) {
      setError('Minimum withdrawal is ₦500');
      return;
    }
    if (parseFloat(amount) > availableBalance) {
      setError('Insufficient available balance');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await requestWithdrawal({
        amount: parseFloat(amount),
        bankDetails
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit withdrawal request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <header className="modal-header">
          <h3>Request Withdrawal</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </header>
        
        <form onSubmit={handleSubmit} className="modal-form">
          <p>Available Balance: ₦{parseFloat(availableBalance).toLocaleString()}</p>
          
          <div className="form-group">
            <label>Amount (NGN)</label>
            <input 
              type="number" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)} 
              placeholder="e.g. 5000"
              required 
            />
          </div>

          <div className="form-group">
            <label>Account Name</label>
            <input 
              type="text" 
              value={bankDetails.accountName} 
              onChange={(e) => setBankDetails({...bankDetails, accountName: e.target.value})} 
              placeholder="Full Name"
              required 
            />
          </div>

          <div className="form-group">
            <label>Account Number</label>
            <input 
              type="text" 
              value={bankDetails.accountNumber} 
              onChange={(e) => setBankDetails({...bankDetails, accountNumber: e.target.value})} 
              placeholder="10 digits"
              required 
            />
          </div>

          <div className="form-group">
            <label>Bank Name</label>
            <input 
              type="text" 
              value={bankDetails.bankName} 
              onChange={(e) => setBankDetails({...bankDetails, bankName: e.target.value})} 
              placeholder="e.g. Zenith Bank"
              required 
            />
          </div>

          {(!bankDetails.accountNumber || !bankDetails.bankName) && (
            <div className="alert alert-warning" style={{ fontSize: '0.85rem', marginBottom: '15px', padding: '10px', background: '#fff3cd', border: '1px solid #ffeeba', borderRadius: '4px' }}>
              ⚠️ You haven't set your primary bank details yet. 
              <button type="button" onClick={() => { onClose(); window.location.href='/dashboard/bank-details'; }} style={{ background: 'none', border: 'none', color: '#856404', textDecoration: 'underline', fontWeight: 'bold', cursor: 'pointer', padding: '0 5px' }}>
                Update now
              </button>
            </div>
          )}

          {error && <p className="error-message">{error}</p>}
          
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Processing...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WithdrawModal;
