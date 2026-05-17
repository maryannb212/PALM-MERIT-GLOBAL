import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
        const token = localStorage.getItem('token');
        const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/referrals`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStats(res.data);
      } catch (err) {
        console.error('Error fetching referrals:', err);
        setError('Failed to load referrals. Please try again.');
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
      <div className="dashboard-header mb-4">
        <div>
          <h2>Referral Hub</h2>
          <p className="subtitle">Invite your network to grow together and double your payout rates</p>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="referrals-grid">
        {/* Left Side: Invitation Card & Lock Status */}
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
                To prevent fraud and maintain the stability of the cooperative, all referral links are temporarily locked for 4 months from registration.
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
                <button className="copy-btn active" onClick={handleCopyLink}>
                  {copied ? <><FaCheckCircle /> Copied</> : <><FaCopy /> Copy Link</>}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Quick Stats Summary */}
        <div className="ref-card stats-overview">
          <h3>Performance Metrics</h3>
          <div className="stats-list mt-4">
            <div className="stat-row">
              <div className="stat-meta">
                <div className="icon-badge"><FaUserFriends /></div>
                <div>
                  <div className="stat-title">Total Referred Users</div>
                  <div className="stat-sub">Registered accounts under your link</div>
                </div>
              </div>
              <div className="stat-value">{stats.downlines.length}</div>
            </div>

            <div className="stat-row">
              <div className="stat-meta">
                <div className="icon-badge green"><FaUserCheck /></div>
                <div>
                  <div className="stat-title">Active Qualified Downlines</div>
                  <div className="stat-sub">Members actively saving (excluding Golden Basket)</div>
                </div>
              </div>
              <div className="stat-value text-accent">{stats.activeQualifiedCount}</div>
            </div>

            <div className="stat-row">
              <div className="stat-meta">
                <div className="icon-badge orange"><FaShieldAlt /></div>
                <div>
                  <div className="stat-title">Payout Eligibility</div>
                  <div className="stat-sub">Requires minimum {stats.eligibilityRequiredCount} active downlines</div>
                </div>
              </div>
              <div className="stat-value">
                {stats.isEligible ? (
                  <span className="status-indicator qualified">QUALIFIED (2x)</span>
                ) : (
                  <span className="status-indicator not-qualified">STANDARD</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Center Row: Onboarding Timeline Rules */}
      <div className="ref-card mt-4 onboarding-timeline-card">
        <h3>How It Works</h3>
        <div className="timeline-steps mt-4">
          <div className="timeline-step">
            <div className="step-num">1</div>
            <h4>Wait Out Lock Period</h4>
            <p>Wait 4 months from your registration date for your referral system to auto-activate securely.</p>
          </div>
          <div className="timeline-arrow"><FaChevronRight /></div>
          <div className="timeline-step">
            <div className="step-num">2</div>
            <h4>Share & Invite Partners</h4>
            <p>Invite at least 2 partners. They must start active standard plans (CREST, SILVER, or ISUSU).</p>
          </div>
          <div className="timeline-arrow"><FaChevronRight /></div>
          <div className="timeline-step">
            <div className="step-num">3</div>
            <h4>Double Payout Settlement</h4>
            <p>Enjoy multiplied 2x payouts on plan settlements (e.g. ₦96k instead of ₦48k for CREST plans!).</p>
          </div>
        </div>

        <div className="onboarding-notice mt-4">
          <div className="icon"><FaInfoCircle /></div>
          <div className="content">
            <strong>Anti-Abuse Rule:</strong> Self-referrals (matching bank accounts, device IDs, or duplicate info) are automatically flagged. 
            Additionally, subscriptions to the <strong>Golden Basket</strong> program are strictly marked as <em>"Non-Referral Registrations"</em> 
            and do NOT count towards referral payouts, eligibility counts, or active downline validation.
          </div>
        </div>
      </div>

      {/* Downlines Table Section */}
      <div className="ref-card mt-4 table-card">
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
                  const hasStandardPlan = downline.plans.some(p => p.planName !== 'GOLDEN_BASKET');
                  
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
  );
};

export default Referrals;
