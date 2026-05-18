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
      
      // Redirect user to the payment gateway to complete actual payment
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
            <div className="provider-options">
              <label className={`provider-card ${provider === 'paystack' ? 'selected' : ''}`}>
                <input 
                  type="radio" 
                  name="provider" 
                  value="paystack" 
                  checked={provider === 'paystack'} 
                  onChange={(e) => setProvider(e.target.value)}
                />
                <img src="https://paystack.com/favicon.png" alt="Paystack" style={{width: '20px', marginRight: '8px'}}/> Paystack
              </label>
              <label className={`provider-card ${provider === 'flutterwave' ? 'selected' : ''}`}>
                <input 
                  type="radio" 
                  name="provider" 
                  value="flutterwave" 
                  checked={provider === 'flutterwave'} 
                  onChange={(e) => setProvider(e.target.value)}
                />
                <img src="https://flutterwave.com/favicon.ico" alt="Flutterwave" style={{width: '20px', marginRight: '8px'}}/> Flutterwave
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
          <div className="manual-transfer-hint" style={{ marginTop: '15px', textAlign: 'center', fontSize: '0.85rem' }}>
            <p>Already made a manual transfer? <a href="/dashboard/receipt" style={{ color: '#800020', fontWeight: 'bold' }}>Upload Receipt Here</a></p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DepositModal;
