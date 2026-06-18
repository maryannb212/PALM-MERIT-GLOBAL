import React, { useState } from 'react';
import { initializeDeposit } from '../services/api';
import './DepositModal.css';

const DepositModal = ({ isOpen, onClose, plan, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;
    if (parseFloat(amount) < 500) {
      setError('Minimum deposit amount is ₦500');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data } = await initializeDeposit({
        amount: parseFloat(amount),
        planId: plan?.id || null,
        payment_provider: 'lotus'
      });
      
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        setError('Payment gateway did not return a valid payment link. Please try again.');
      }
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
        
        <div style={{ padding: '0 20px' }}>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Amount (NGN) — minimum ₦500</label>
            <input 
              type="number" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)} 
              placeholder="e.g. 5000"
              min="500"
              required 
            />
          </div>

          {error && <p className="error-message">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Processing...' : '💳 Pay with Card'}
            </button>
          </div>


        </form>
      </div>
    </div>
  );
};

export default DepositModal;
