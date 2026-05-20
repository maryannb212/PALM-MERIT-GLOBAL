import React, { useState, useEffect } from 'react';
import API from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { 
  FaLock, FaUnlock, FaCopy, FaCheckCircle, FaUserFriends, 
  FaUserCheck, FaTimesCircle, FaExclamationTriangle,
  FaShieldAlt, FaInfoCircle, FaCalendarAlt, FaStar, FaChartLine
} from 'react-icons/fa';
import './Dashboard.css';
import './Referrals.css';

const Referrals = () => {
  const { user, refreshProfile } = useAuth();
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
    if (refreshProfile) {
      refreshProfile();
    }
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
        return <span className="badge-status qualified"><FaCheckCircle /> Qualified</span>;
      case 'active':
        return <span className="badge-status active"><FaCheckCircle /> Active</span>;
      case 'pending':
        return <span className="badge-status pending"><FaExclamationTriangle /> Pending</span>;
      case 'disqualified':
        return <span className="badge-status disqualified"><FaTimesCircle /> Disqualified</span>;
      case 'inactive':
      default:
        return <span className="badge-status inactive"><FaInfoCircle /> Inactive</span>;
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
      {error && (
        <div className="premium-error-card">
          <div className="error-icon"><FaExclamationTriangle /></div>
          <div className="error-details">
            <h4>System Notice</h4>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="ref-hero-section">
        <div className="ref-hero-bg-accent"></div>
        <div className="ref-hero-bg-accent gold"></div>
        
        <div className="ref-hero-content">
          <h2>Referral Hub</h2>
          <p>Invite your network to grow together and double your payout rates</p>
          
          <div className="ref-glass-card">
            {isLocked ? (
              <div className="ref-locked-state">
                <FaLock className="lock-icon-hero" />
                <h3>Referral Link Locked</h3>
                <p>To prevent fraud and maintain cooperative stability, all referral links are temporarily locked for 1 month from registration.</p>
                
                <div className="ref-countdown">{timeLeft || 'Calculating...'}</div>
                <p className="text-muted" style={{fontSize: '0.9rem'}}>Unlocks on {unlockDate ? unlockDate.toLocaleDateString(undefined, { dateStyle: 'long' }) : 'N/A'}</p>
                
                <div className="ref-input-wrapper mt-3">
                  <input type="text" value="https://palmmeritglobal.com/ref/LOCKED..." disabled />
                  <button disabled className="ref-copy-btn"><FaCopy /> Copy</button>
                </div>
              </div>
            ) : (
              <div className="ref-unlocked-state">
                <FaUnlock className="lock-icon-hero" style={{color: '#10b981'}} />
                <h3>Your Invitation Link is Active!</h3>
                <p>Share this personalized link with colleagues, friends, or family. When they register and start saving actively, you qualify for 2x payout multipliers!</p>
                
                <div className="ref-input-wrapper mt-3">
                  <input type="text" value={referralLink} readOnly onClick={(e) => e.target.select()} />
                  <button className={`ref-copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopyLink}>
                    {copied ? <><FaCheckCircle /> Copied</> : <><FaCopy /> Copy</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="ref-metrics-row">
        <div className="ref-metric-card">
          <div className="ref-metric-icon blue"><FaUserFriends /></div>
          <div className="ref-metric-details">
            <span>Total Referred</span>
            <h4>{stats.downlines.length}</h4>
          </div>
        </div>
        
        <div className="ref-metric-card">
          <div className="ref-metric-icon green"><FaUserCheck /></div>
          <div className="ref-metric-details">
            <span>Active Qualified</span>
            <h4>{stats.activeQualifiedCount}</h4>
          </div>
        </div>

        <div className="ref-metric-card">
          <div className="ref-metric-icon gold"><FaShieldAlt /></div>
          <div className="ref-metric-details">
            <span>Payout Status</span>
            <h4>
              {stats.isEligible ? 'QUALIFIED' : 'STANDARD'}
              {stats.isEligible ? <span className="pill-qualified">2X</span> : <span className="pill-standard">1X</span>}
            </h4>
          </div>
        </div>
      </div>

      <div className="ref-bottom-section">
        {/* Horizontal Timeline Step Guide */}
        <div className="ref-card">
          <h3 style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FaInfoCircle color="#0f172a" /> How It Works
          </h3>
          
          <div className="ref-timeline">
            <div className="ref-timeline-step">
              <div className="ref-timeline-icon"><FaCalendarAlt /></div>
              <div className="ref-timeline-content">
                <h4>1. Wait Out Lock Period</h4>
                <p>Wait 1 month from registration for link auto-activation.</p>
              </div>
            </div>
            <div className="ref-timeline-step">
              <div className="ref-timeline-icon"><FaUserFriends /></div>
              <div className="ref-timeline-content">
                <h4>2. Invite Partners</h4>
                <p>Invite at least 2 partners. They must start active plans.</p>
              </div>
            </div>
            <div className="ref-timeline-step">
              <div className="ref-timeline-icon"><FaStar /></div>
              <div className="ref-timeline-content">
                <h4>3. Double Payouts</h4>
                <p>Enjoy multiplied 2x payouts on plan settlements.</p>
              </div>
            </div>
          </div>

          <div className="ref-anti-abuse">
            <div className="icon"><FaExclamationTriangle /></div>
            <div className="content">
              <strong>Anti-Abuse Rule:</strong> Golden Basket plans are excluded from referral payouts and do NOT count towards downline validation.
            </div>
          </div>
        </div>

        {/* Referred Downlines Table */}
        <div className="ref-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><FaChartLine color="#0f172a" /> Referred Downlines</h3>
            <span style={{background: '#f1f5f9', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold'}}>{stats.downlines.length} Members</span>
          </div>

          {stats.downlines.length === 0 ? (
            <div style={{textAlign: 'center', padding: '40px 0'}}>
              <FaUserFriends style={{fontSize: '3rem', color: '#cbd5e1', margin: '0 auto 15px', display: 'block'}} />
              <h4 style={{color: '#64748b'}}>No members registered yet</h4>
              <p style={{color: '#94a3b8', fontSize: '0.9rem'}}>Share your link to see your network grow here.</p>
            </div>
          ) : (
            <div className="ref-table-wrapper">
              <table className="ref-premium-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Joined Date</th>
                    <th>Active Programs</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.downlines.map((downline) => {
                    const goldenBasketOnly = downline.plans.length > 0 && downline.plans.every(p => p.planName === 'GOLDEN_BASKET');
                    return (
                      <tr key={downline.id}>
                        <td style={{fontWeight: '600'}}>{downline.firstName} {downline.lastName}</td>
                        <td>{new Date(downline.createdAt).toLocaleDateString()}</td>
                        <td>
                          {downline.plans.length === 0 ? (
                            <span className="plan-pill none">None</span>
                          ) : goldenBasketOnly ? (
                            <span className="plan-pill golden" title="Excluded from referrals">Golden Basket</span>
                          ) : (
                            downline.plans.filter(p => p.planName !== 'GOLDEN_BASKET').map(p => (
                              <span key={p.planName} className="plan-pill">{p.planName}</span>
                            ))
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
  );
};

export default Referrals;
