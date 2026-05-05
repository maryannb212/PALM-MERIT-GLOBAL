import React, { useState } from 'react';
import { initializeMembership, uploadMembershipReceipt } from '../services/api';
import { FaWhatsapp, FaFacebook, FaInstagram, FaEnvelope, FaUpload } from 'react-icons/fa';
import './MembershipPaywall.css';

const MembershipPaywall = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState('paystack');
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
        payment_provider: provider
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
          
          <div className="whatsapp-join">
            <h3>Join our Community</h3>
            <p>Connect with other members and get real-time updates.</p>
            <a href="https://chat.whatsapp.com/your-group-link" target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp">
              <FaWhatsapp /> Join General WhatsApp Group
            </a>
          </div>

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
            <div className="provider-selection" style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Choose Gateway:</label>
              <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input type="radio" value="paystack" checked={provider === 'paystack'} onChange={(e) => setProvider(e.target.value)} style={{ marginRight: '8px' }} />
                  Paystack
                </label>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input type="radio" value="flutterwave" checked={provider === 'flutterwave'} onChange={(e) => setProvider(e.target.value)} style={{ marginRight: '8px' }} />
                  Flutterwave
                </label>
              </div>
            </div>
            <button className="btn btn-primary full-width" onClick={handlePayNow} disabled={loading}>
              {loading ? 'Processing...' : 'Pay Online Now'}
            </button>
            
            <div className="divider"><span>OR</span></div>

            <div className="manual-payment">
              <h3>Manual Bank Transfer</h3>
              <p className="bank-details">
                <strong>Bank:</strong> Zenith Bank<br />
                <strong>Account Name:</strong> Palm Merit Global Resources<br />
                <strong>Account Number:</strong> 1234567890
              </p>
              
              <div className="upload-section">
                <label htmlFor="receipt-upload" className="upload-label">
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
          </div>
          {error && <p className="error-message">{error}</p>}
        </div>
        
        <div className="paywall-footer">
          <p>Need help? Contact us at <a href="mailto:support@palmmerit.com">support@palmmerit.com</a></p>
        </div>
      </div>
    </div>
  );
};

export default MembershipPaywall;
