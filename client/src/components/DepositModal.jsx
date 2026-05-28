import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { initializeDeposit, generateVirtualAccount } from '../services/api';
import './DepositModal.css';

const DepositModal = ({ isOpen, onClose, plan, onSuccess }) => {
  const { user, updateUser } = useAuth();
  const [amount, setAmount] = useState('');
  const [internalProvider] = useState('flutterwave');
  const [loading, setLoading] = useState(false);
  const [generatingVA, setGeneratingVA] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const handleGenerateVA = async () => {
    setGeneratingVA(true);
    try {
      const response = await generateVirtualAccount();
      alert(response.data.message || 'Virtual account successfully generated!');
      updateUser({
        virtual_account_number: response.data.virtual_account_number,
        virtual_bank_name: response.data.virtual_bank_name,
        virtual_account_name: response.data.virtual_account_name
      });
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to generate virtual account');
    } finally {
      setGeneratingVA(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;

    setLoading(true);
    setError('');

    try {
      const { data } = await initializeDeposit({
        amount: parseFloat(amount),
        planId: plan?.id || null,
        payment_provider: internalProvider
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

  const hasVirtualAccount = user?.virtual_account_number && user?.virtual_bank_name !== 'Palm Merit Finance';

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <header className="modal-header">
          <h3>{plan ? `Top Up: ${plan.plan_name}` : 'Fund Your Wallet'}</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </header>
        
        <div style={{ padding: '0 20px' }}>
          {/* Virtual Account Section */}
          <div style={{ 
            background: 'linear-gradient(135deg, #f8f9fa, #e9ecef)', 
            padding: '20px', 
            borderRadius: '12px', 
            border: '1px solid #dee2e6',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '1.3rem' }}>🏦</span>
              <h4 style={{ margin: 0, color: '#800020', fontSize: '1rem' }}>Transfer via Your Virtual Account</h4>
            </div>
            
            {hasVirtualAccount ? (
              <div style={{ background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                <div style={{ 
                  fontSize: '1.4rem', 
                  fontWeight: 'bold', 
                  letterSpacing: '2px', 
                  color: '#800020', 
                  marginBottom: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  {user.virtual_account_number}
                  <button onClick={() => handleCopy(user.virtual_account_number)} style={{ 
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#6c757d' 
                  }} title="Copy">📋</button>
                </div>
                <div style={{ fontSize: '0.95rem', color: '#333', fontWeight: '600' }}>{user.virtual_bank_name}</div>
                <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '3px' }}>{user.virtual_account_name}</div>
                <p style={{ fontSize: '0.8rem', color: '#28a745', marginTop: '10px', marginBottom: 0, fontWeight: '500' }}>
                  ✅ Transfer any amount here — it reflects in your wallet automatically!
                </p>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '10px' }}>You don't have a virtual account yet.</p>
                <button 
                  onClick={handleGenerateVA}
                  disabled={generatingVA}
                  className="btn btn-secondary"
                  style={{ padding: '8px 18px', borderRadius: '6px', fontSize: '0.9rem' }}
                >
                  {generatingVA ? 'Generating...' : 'Generate Virtual Account'}
                </button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: '12px', margin: '15px 0',
            color: '#999', fontSize: '0.85rem' 
          }}>
            <div style={{ flex: 1, height: '1px', background: '#ddd' }}></div>
            <span>OR pay instantly with card</span>
            <div style={{ flex: 1, height: '1px', background: '#ddd' }}></div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
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

          {error && <p className="error-message">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Processing...' : '💳 Pay with Card'}
            </button>
          </div>

          <div className="security-notice" style={{ marginTop: '15px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.78rem', color: '#475569', textAlign: 'center', lineHeight: '1.5' }}>
            <p style={{ margin: '0 0 5px 0', color: '#0f172a', fontWeight: 'bold' }}>🔒 Secure Payment</p>
            <p style={{ margin: 0 }}>
              Payments are processed securely via <strong>Flutterwave</strong>. Virtual account transfers are credited <strong>automatically</strong>.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DepositModal;
