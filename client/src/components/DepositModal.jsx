import React, { useState } from 'react';
import { initializeDeposit } from '../services/api';
import './DepositModal.css';

const DepositModal = ({ isOpen, onClose, plan, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [internalProvider] = useState(Math.random() > 0.5 ? 'paystack' : 'flutterwave');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (paymentMethod !== 'card') return; // Prevent submission for bank transfer
    if (!amount || parseFloat(amount) <= 0) return;

    setLoading(true);
    setError('');

    try {
      const { data } = await initializeDeposit({
        amount: parseFloat(amount),
        planId: plan?.id || null,
        payment_provider: internalProvider
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
            <label>Payment Method</label>
            <div className="provider-options" style={{ display: 'flex', gap: '10px' }}>
              <label className={`provider-card ${paymentMethod === 'card' ? 'selected' : ''}`} style={{ flex: 1, padding: '15px', textAlign: 'center', cursor: 'pointer', border: paymentMethod === 'card' ? '2px solid #800020' : '1px solid #cbd5e1', borderRadius: '8px' }}>
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value="card" 
                  checked={paymentMethod === 'card'} 
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{ display: 'none' }}
                />
                💳 Card Payment
              </label>
              <label className={`provider-card ${paymentMethod === 'bank' ? 'selected' : ''}`} style={{ flex: 1, padding: '15px', textAlign: 'center', cursor: 'pointer', border: paymentMethod === 'bank' ? '2px solid #800020' : '1px solid #cbd5e1', borderRadius: '8px' }}>
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value="bank" 
                  checked={paymentMethod === 'bank'} 
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{ display: 'none' }}
                />
                🏦 Bank Transfer
              </label>
            </div>
          </div>
          
          {error && <p className="error-message">{error}</p>}

          {paymentMethod === 'card' ? (
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Processing...' : 'Proceed to Payment'}
              </button>
            </div>
          ) : (
            <div className="manual-transfer-hint" style={{ marginTop: '15px', textAlign: 'center', fontSize: '0.85rem', background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <p style={{ fontWeight: 'bold', marginBottom: '12px', color: '#1e293b', fontSize: '1rem' }}>Manual Bank Transfer</p>
              <div style={{ textAlign: 'left', display: 'inline-block', marginBottom: '15px', color: '#475569', fontSize: '0.9rem', background: '#fff', padding: '15px', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                <strong style={{color: '#0f172a'}}>Bank Name:</strong> Sterling Bank<br/>
                <strong style={{color: '#0f172a'}}>Account Name:</strong> palm merit global limited<br/>
                <strong style={{color: '#0f172a'}}>Account No:</strong> 0145238769<br/>
                <strong style={{color: '#0f172a'}}>Account Type:</strong> Business
              </div>
              <p style={{margin: '0 0 15px 0', color: '#64748b'}}>After transferring, please upload your receipt for verification.</p>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                <a href="/dashboard/receipt" className="btn btn-primary" style={{textDecoration: 'none'}}>Upload Receipt</a>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default DepositModal;
