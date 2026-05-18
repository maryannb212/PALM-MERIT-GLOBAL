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

          {/* Join Community Section (Before Payment) */}
          <div className="whatsapp-join-prepay" style={{ background: 'rgba(37, 211, 102, 0.08)', border: '1px dashed #25D366', borderRadius: '12px', padding: '18px', marginBottom: '25px', textAlign: 'center' }}>
            <h3 style={{ color: '#27ae60', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: 'bold' }}>
              <FaWhatsapp size={22} /> Join Our Community First!
            </h3>
            <p style={{ margin: '0 0 14px 0', fontSize: '0.9rem', color: '#4b5563', lineHeight: '1.4' }}>
              Connect with thousands of fellow members, ask questions, and receive real-time updates in our WhatsApp general group.
            </p>
            <a 
              href="https://chat.whatsapp.com/your-group-link" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn btn-whatsapp"
              style={{ background: '#25D366', color: 'white', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.92rem', textDecoration: 'none', boxShadow: '0 2px 4px rgba(37, 211, 102, 0.2)', transition: 'transform 0.2s' }}
            >
              <FaWhatsapp /> Join General WhatsApp Group
            </a>
            
            <div className="social-connect-prepay" style={{ marginTop: '15px', borderTop: '1px solid #e5e7eb', paddingTop: '12px' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#6b7280', fontWeight: '500' }}>Follow Palm Merit Global:</p>
              <div className="social-icons" style={{ display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '1.25rem' }}>
                <a href="https://facebook.com/palmmerit" target="_blank" rel="noreferrer" style={{ color: '#1877F2' }}><FaFacebook /></a>
                <a href="https://instagram.com/palmmerit" target="_blank" rel="noreferrer" style={{ color: '#E1306C' }}><FaInstagram /></a>
                <a href="mailto:support@palmmerit.com" style={{ color: '#e06000' }}><FaEnvelope /></a>
              </div>
            </div>
          </div>

          <div className="payment-options">
            <div className="provider-selection" style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Choose Gateway:</label>
              <div className="provider-options">
                <label className={`provider-card ${provider === 'paystack' ? 'selected' : ''}`}>
                  <input type="radio" value="paystack" checked={provider === 'paystack'} onChange={(e) => setProvider(e.target.value)} />
                  <img src="https://paystack.com/favicon.png" alt="Paystack" style={{width: '20px', marginRight: '8px'}}/> Paystack
                </label>
                <label className={`provider-card ${provider === 'flutterwave' ? 'selected' : ''}`}>
                  <input type="radio" value="flutterwave" checked={provider === 'flutterwave'} onChange={(e) => setProvider(e.target.value)} />
                  <img src="https://flutterwave.com/favicon.ico" alt="Flutterwave" style={{width: '20px', marginRight: '8px'}}/> Flutterwave
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
