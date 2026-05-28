import React, { useState } from 'react';
import { initializeMembership } from '../services/api';
import { FaFacebook, FaInstagram, FaEnvelope } from 'react-icons/fa';
import './MembershipPaywall.css';

const MembershipPaywall = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [internalProvider] = useState('flutterwave');
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
            <li>✅ Get your dedicated Virtual Funding Account</li>
            <li>✅ Exclusive community support & mentorship</li>
            <li>✅ Weekly impact and growth updates</li>
          </ul>

          <div className="payment-options">
            <button className="btn btn-primary full-width" onClick={handlePayNow} disabled={loading} style={{
              padding: '14px 30px',
              fontSize: '1.05rem',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              boxShadow: '0 4px 15px rgba(128, 0, 32, 0.25)',
              background: 'linear-gradient(135deg, #800020, #a30029)',
              border: 'none',
              color: 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              borderRadius: '10px',
              transition: 'all 0.3s ease',
              width: '100%'
            }}>
              {loading ? 'Processing...' : '💳 Pay ₦500 & Activate Now'}
            </button>
          </div>

          {error && <p className="error-message">{error}</p>}
          
          <div className="security-notice" style={{ marginTop: '25px', padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#475569', textAlign: 'center', lineHeight: '1.5' }}>
            <p style={{ margin: '0 0 8px 0', color: '#0f172a', fontWeight: 'bold' }}>🔒 Secure Cooperative Contribution</p>
            <p style={{ margin: 0 }}>
              Payment is processed securely via <strong>Flutterwave</strong>. Once payment is confirmed, your membership is <strong>activated automatically</strong> — no admin approval needed.
              <br/><br/>
              After activation, you'll get access to your <strong>personal Virtual Funding Account</strong> for instant wallet top-ups.
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
