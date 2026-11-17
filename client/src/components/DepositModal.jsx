import React, { useState } from 'react';
import { initializeDeposit } from '../services/api';
import './DepositModal.css';

const DepositModal = ({ isOpen, onClose, plan, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fundingTermsConfirmed, setFundingTermsConfirmed] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;
    if (parseFloat(amount) < 500) {
      setError('Minimum deposit amount is ₦500');
      return;
    }
    if (!fundingTermsConfirmed) {
      setError('Please confirm the Terms & Conditions before funding your wallet.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data } = await initializeDeposit({
        amount: parseFloat(amount),
        planId: plan?.id || null,
        payment_provider: 'lotus',
        fundingTermsConfirmed: true,
        fundingTermsVersion: '1.0'
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

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '16px', fontSize: '0.85rem', lineHeight: 1.4 }}>
            <input
              type="checkbox"
              checked={fundingTermsConfirmed}
              onChange={(e) => setFundingTermsConfirmed(e.target.checked)}
              required
            />
            <span>By proceeding with this funding, I confirm that I have read and agreed to Palm Merit&apos;s <a href="/terms" target="_blank" rel="noreferrer">Terms &amp; Conditions</a>.</span>
          </label>

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
