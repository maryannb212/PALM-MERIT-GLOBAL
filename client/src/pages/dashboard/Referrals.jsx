import React, { useState, useEffect } from 'react';
import API from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { 
  FaLock, FaUnlock, FaCopy, FaCheckCircle, FaUserFriends, 
  FaUserCheck, FaChevronRight, FaTimesCircle, FaExclamationTriangle,
  FaShieldAlt, FaInfoCircle
} from 'react-icons/fa';
import './Dashboard.css';

const Referrals = () => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    downlines: [],
    activeQualifiedCount: 0,
    eligibilityRequiredCount: 2,
    isEligible: false
  });
  const [error, setError] = useState('');

  // Fetch referrals from API
  useEffect(() => {
    const fetchReferrals = async () => {
      try {
        setLoading(true);
        const res = await API.get('/auth/referrals');
        setStats(res.data);
      } catch (err) {
        console.error('Error fetching referrals:', err);
        setError('Failed to load referrals. Please verify your connection or try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchReferrals();
  }, []);

  const referralCode = user?.referralCode || 'NOT-AVAILABLE';
  const referralLink = `${window.location.origin}/register?ref=${referralCode}`;

  // Parse Unlock Date
  const unlockDate = user?.referralUnlockDate ? new Date(user.referralUnlockDate) : null;
  const isLocked = unlockDate ? new Date() < unlockDate : true;

  // Calculate Countdown
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    if (!unlockDate || !isLocked) return;

    const updateCountdown = () => {
      const diff = unlockDate.getTime() - new Date().getTime();
      if (diff <= 0) {
        setTimeLeft('');
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      if (days > 0) {
        setTimeLeft(`${days} days, ${hours} hours`);
      } else {
        setTimeLeft(`${hours} hours left`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [unlockDate, isLocked]);

  const handleCopyLink = () => {
    if (isLocked) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'qualified':
        return <span className="ref-badge qualified"><FaCheckCircle /> Qualified</span>;
      case 'active':
        return <span className="ref-badge active"><FaCheckCircle /> Active</span>;
      case 'pending':
        return <span className="ref-badge pending"><FaExclamationTriangle /> Pending</span>;
      case 'disqualified':
        return <span className="ref-badge disqualified"><FaTimesCircle /> Disqualified</span>;
      case 'inactive':
      default:
        return <span className="ref-badge inactive"><FaInfoCircle /> Inactive</span>;
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading referral system...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container referrals-page">
      <div className="referral-welcome-banner mb-4">
        <div className="banner-content">
          <h2>Referral Hub</h2>
          <p>Invite your network to grow together and double your payout rates</p>
        </div>
        <div className="banner-decoration"></div>
      </div>

      {error && (
        <div className="premium-error-card mb-4">
          <div className="error-icon"><FaExclamationTriangle /></div>
          <div className="error-details">
            <h4>System Notice</h4>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="referral-hub-layout">
        {/* Left Column: Invitation and Stepper Info */}
        <div className="hub-sidebar">
          {/* Invitation Card */}
          <div className="ref-card invitation-panel">
            <div className="panel-header">
              <h3>Your Invitation Link</h3>
              <span className={`lock-pill ${isLocked ? 'locked' : 'unlocked'}`}>
                {isLocked ? <><FaLock /> Locked</> : <><FaUnlock /> Unlocked</>}
              </span>
            </div>

            {isLocked ? (
              <div className="lock-details-overlay">
                <div className="lock-icon-container">
                  <FaLock className="huge-lock-icon" />
                </div>
                <h4>Referral Link Locked</h4>
                <p className="overlay-desc">
                  To prevent fraud and maintain cooperative stability, all referral links are temporarily locked for 1 month from registration.
                </p>
                
                <div className="countdown-display mt-4">
                  <div className="countdown-label">Activation Countdown</div>
                  <div className="countdown-timer">{timeLeft || 'Calculating...'}</div>
                  <div className="countdown-subtext">Unlocks on {unlockDate ? unlockDate.toLocaleDateString(undefined, { dateStyle: 'long' }) : 'N/A'}</div>
                </div>

                {/* Fake input display */}
                <div className="referral-input-group locked mt-4">
                  <input type="text" value="https://palmmeritglobal.com/ref/LOCKED..." disabled />
                  <button disabled className="copy-btn-locked"><FaCopy /></button>
                </div>
              </div>
            ) : (
              <div className="link-active-container">
                <p className="invitation-text">
                  Share this personalized link with colleagues, friends, or family. When they register and start saving actively, you qualify for 2x payout multipliers!
                </p>
                
                <div className="referral-input-group mt-4">
                  <input type="text" value={referralLink} readOnly onClick={(e) => e.target.select()} />
                  <button className={`copy-btn active ${copied ? 'copied-success' : ''}`} onClick={handleCopyLink}>
                    {copied ? <><FaCheckCircle /> Copied</> : <><FaCopy /> Copy Link</>}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Stepper Card */}
          <div className="ref-card rules-panel mt-4">
            <h3>How It Works</h3>
            <div className="vertical-stepper mt-4">
              <div className="step-item">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h4>Wait Out Lock Period</h4>
                  <p>Wait 1 month from registration for referral link auto-activation.</p>
                </div>
              </div>
              <div className="step-item">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h4>Invite Partners</h4>
                  <p>Invite at least 2 partners. They must start active plans (CREST, SILVER, or ISUSU).</p>
                </div>
              </div>
              <div className="step-item">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h4>Double Payout Settlement</h4>
                  <p>Enjoy multiplied 2x payouts on plan settlements (e.g. ₦96k instead of ₦48k for CREST!).</p>
                </div>
              </div>
            </div>

            <div className="onboarding-notice mt-4">
              <div className="icon"><FaInfoCircle /></div>
              <div className="content">
                <strong>Anti-Abuse Rule:</strong> Golden Basket plans are excluded from referral payouts and do NOT count towards downline validation.
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Metrics Row and Table */}
        <div className="hub-main-content">
          <div className="metrics-cards-grid">
            <div className="metric-box">
              <div className="metric-icon-wrap"><FaUserFriends /></div>
              <div className="metric-info">
                <span className="metric-label">Total Referred Users</span>
                <h4 className="metric-val">{stats.downlines.length}</h4>
                <p className="metric-desc">Registered accounts</p>
              </div>
            </div>

            <div className="metric-box green">
              <div className="metric-icon-wrap"><FaUserCheck /></div>
              <div className="metric-info">
                <span className="metric-label">Active Qualified</span>
                <h4 className="metric-val">{stats.activeQualifiedCount}</h4>
                <p className="metric-desc">Members saving actively</p>
              </div>
            </div>

            <div className="metric-box gold">
              <div className="metric-icon-wrap"><FaShieldAlt /></div>
              <div className="metric-info">
                <span className="metric-label">Payout Eligibility</span>
                <h4 className="metric-val">
                  {stats.isEligible ? (
                    <span className="eligible-pill">QUALIFIED (2x)</span>
                  ) : (
                    <span className="standard-pill">STANDARD</span>
                  )}
                </h4>
                <p className="metric-desc">Min. 2 active downlines</p>
              </div>
            </div>
          </div>

          {/* Referred Downlines Card */}
          <div className="ref-card table-card mt-4">
            <div className="panel-header">
              <h3>Your Referred Downlines</h3>
              <span className="count-pill">{stats.downlines.length} members</span>
            </div>

            {stats.downlines.length === 0 ? (
              <div className="empty-state mt-4">
                <FaUserFriends className="empty-icon" />
                <h4>No members registered yet</h4>
                <p>Once your referral link is active, share it with others to see them here.</p>
              </div>
            ) : (
              <div className="table-responsive mt-4">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Joined Date</th>
                      <th>Cooperative Program Active</th>
                      <th>Downline Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.downlines.map((downline) => {
                      const goldenBasketOnly = downline.plans.length > 0 && downline.plans.every(p => p.planName === 'GOLDEN_BASKET');
                      
                      return (
                        <tr key={downline.id}>
                          <td className="font-weight-bold">{downline.firstName} {downline.lastName}</td>
                          <td>{new Date(downline.createdAt).toLocaleDateString()}</td>
                          <td>
                            {downline.plans.length === 0 ? (
                              <span className="ref-plan-pill none">None</span>
                            ) : goldenBasketOnly ? (
                              <span className="ref-plan-pill golden-basket-label" title="Golden Basket plans are excluded from referral benefits">
                                Golden Basket (Non-Referral)
                              </span>
                            ) : (
                              <span className="ref-plan-pill active-plan">
                                {downline.plans.filter(p => p.planName !== 'GOLDEN_BASKET').map(p => p.planName).join(', ')}
                              </span>
                            )}
                          </td>
                          <td>{getStatusBadge(downline.referralStatus)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Referrals;
