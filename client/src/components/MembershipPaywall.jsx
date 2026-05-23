import React, { useState } from 'react';
import { initializeMembership, uploadMembershipReceipt } from '../services/api';
import { FaWhatsapp, FaFacebook, FaInstagram, FaEnvelope, FaUpload } from 'react-icons/fa';
import './MembershipPaywall.css';

const MembershipPaywall = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [internalProvider] = useState('flutterwave');
  const [receiptUploaded, setReceiptUploaded] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');

  const handlePayNow = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await initializeMembership({
        amount: 500,
        type: 'membership',
        payment_provider: internalProvider
      });
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      }
    } catch (err) {
      setError('Failed to initialize payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReceiptUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setLoading(true);
      setError('');
      try {
        const formData = new FormData();
        formData.append('receipt', file);
        await uploadMembershipReceipt(formData);
        setReceiptUploaded(true);
        setShowSuccess(true);
      } catch (err) {
        setError('Failed to upload receipt. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  if (showSuccess) {
    return (
      <div className="paywall-container">
        <div className="paywall-card success-card">
          <div className="success-icon">✅</div>
          <h2>Payment Submitted!</h2>
          <p>Thank you, {user?.firstName}. Our team will verify your receipt shortly.</p>
          
          <div className="social-connect">
            <p>Follow us for more updates:</p>
            <div className="social-icons">
              <a href="https://facebook.com/palmmerit" target="_blank" rel="noreferrer"><FaFacebook /></a>
              <a href="https://instagram.com/palmmerit" target="_blank" rel="noreferrer"><FaInstagram /></a>
              <a href="mailto:support@palmmerit.com"><FaEnvelope /></a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="paywall-container">
      <div className="paywall-card">
        <header className="paywall-header">
          <h2>Activate Your Membership</h2>
          <p>Join Palm Merit Global and start your journey of impact.</p>
        </header>

        <div className="paywall-body">
          <div className="fee-badge">
            <span className="amount">₦500</span>
            <span className="label">One-time Activation Fee</span>
          </div>

          <ul className="benefits-list">
            <li>✅ Full access to all Savings Programmes</li>
            <li>✅ Create and manage your digital wallet</li>
            <li>✅ Exclusive community support & mentorship</li>
            <li>✅ Weekly impact and growth updates</li>
          </ul>

          <div className="payment-options">
            <div className="provider-selection" style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Payment Method:</label>
              <div className="provider-options" style={{ display: 'flex', gap: '10px' }}>
                <label className={`provider-card ${paymentMethod === 'card' ? 'selected' : ''}`} style={{ flex: 1, padding: '15px', textAlign: 'center', cursor: 'pointer', border: paymentMethod === 'card' ? '2px solid #800020' : '1px solid #cbd5e1', borderRadius: '8px' }}>
                  <input type="radio" name="paymentMethod" value="card" checked={paymentMethod === 'card'} onChange={(e) => setPaymentMethod(e.target.value)} style={{ display: 'none' }} />
                  💳 Card Payment
                </label>
                <label className={`provider-card ${paymentMethod === 'bank' ? 'selected' : ''}`} style={{ flex: 1, padding: '15px', textAlign: 'center', cursor: 'pointer', border: paymentMethod === 'bank' ? '2px solid #800020' : '1px solid #cbd5e1', borderRadius: '8px' }}>
                  <input type="radio" name="paymentMethod" value="bank" checked={paymentMethod === 'bank'} onChange={(e) => setPaymentMethod(e.target.value)} style={{ display: 'none' }} />
                  🏦 Bank Transfer
                </label>
              </div>
            </div>

            {paymentMethod === 'card' ? (
              <button className="btn btn-primary full-width" onClick={handlePayNow} disabled={loading}>
                {loading ? 'Processing...' : 'Pay Online Now'}
              </button>
            ) : (
              <div className="manual-payment" style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', color: '#1e293b' }}>Manual Bank Transfer</h3>
                <div style={{ textAlign: 'left', marginBottom: '20px', color: '#475569', fontSize: '0.95rem', background: '#fff', padding: '15px', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                  <strong style={{color: '#0f172a'}}>Bank Name:</strong> Sterling Bank<br />
                  <strong style={{color: '#0f172a'}}>Account Name:</strong> palm merit global limited<br />
                  <strong style={{color: '#0f172a'}}>Account Number:</strong> 0145238769<br />
                  <strong style={{color: '#0f172a'}}>Account Type:</strong> Business
                </div>
                
                <div className="upload-section">
                  <label htmlFor="receipt-upload" className="upload-label" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <FaUpload /> {receiptUploaded ? 'Receipt Uploaded' : 'Upload Payment Receipt'}
                  </label>
                  <input 
                    type="file" 
                    id="receipt-upload" 
                    accept="image/*,.pdf" 
                    onChange={handleReceiptUpload}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
            )}
          </div>
          {error && <p className="error-message">{error}</p>}
          
          <div className="security-notice" style={{ marginTop: '25px', padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#475569', textAlign: 'center', lineHeight: '1.5' }}>
            <p style={{ margin: '0 0 8px 0', color: '#0f172a', fontWeight: 'bold' }}>🔒 Secure Cooperative Contribution</p>
            <p style={{ margin: 0 }}>
              Payment gateways (like Flutterwave or Paystack) and your bank are <strong>strictly used to securely process your deposit</strong> into the platform. 
              <br/><br/>
              <strong>PALM MERIT GLOBAL</strong> internally manages your cooperative tracking, savings lifecycle, referral validation, and payouts.
            </p>
          </div>
        </div>
        
        <div className="paywall-footer">
          <p>Need help? Contact us at <a href="mailto:support@palmmerit.com">support@palmmerit.com</a></p>
        </div>
      </div>
    </div>
  );
};

export default MembershipPaywall;
