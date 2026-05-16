import React, { useState } from 'react';
import { initializeDeposit } from '../services/api';
import './DepositModal.css';

const DepositModal = ({ isOpen, onClose, plan, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [provider, setProvider] = useState('paystack');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;

    setLoading(true);
    setError('');

    try {
      const { data } = await initializeDeposit({
        amount: parseFloat(amount),
        planId: plan?.id || null,
        payment_provider: provider
      });
      
      if (onSuccess) onSuccess();
      // Auto redirect to receipt upload after initialization
      setTimeout(() => {
        window.location.href = '/dashboard/receipt';
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to initialize deposit.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <header className="modal-header">
          <h3>{plan ? `Top Up: ${plan.plan_name}` : 'Fund Your Wallet'}</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </header>
        
        <form onSubmit={handleSubmit} className="modal-form">
          <p>How much would you like to add to your savings?</p>
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
            <label>Choose Payment Provider</label>
            <div className="provider-options" style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="provider" 
                  value="paystack" 
                  checked={provider === 'paystack'} 
                  onChange={(e) => setProvider(e.target.value)}
                  style={{ marginRight: '8px' }}
                />
                Paystack
              </label>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="provider" 
                  value="flutterwave" 
                  checked={provider === 'flutterwave'} 
                  onChange={(e) => setProvider(e.target.value)}
                  style={{ marginRight: '8px' }}
                />
                Flutterwave
              </label>
            </div>
          </div>
          {error && <p className="error-message">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Processing...' : 'Proceed to Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DepositModal;
