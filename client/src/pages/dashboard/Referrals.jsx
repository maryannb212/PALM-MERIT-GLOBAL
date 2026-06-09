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
    myCodes: [],
    activeQualifiedCount: 0,
    eligibilityRequiredCount: 1,
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

  const legacyCode = user?.referralCode || 'NOT-AVAILABLE';
  const codesToDisplay = stats.myCodes && stats.myCodes.length > 0 
    ? stats.myCodes 
    : (user?.referralCode ? [{
        code: legacyCode,
        plan_name: 'Legacy Account',
        status: isLocked ? 'locked' : isExpired ? 'expired' : 'available',
        unlock_date: unlockTimestamp ? new Date(unlockTimestamp).toISOString() : null
      }] : []);

  const handleCopyLink = (code) => {
    const link = `${window.location.origin}/register?ref=${code}`;
    navigator.clipboard.writeText(link);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
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
          <p>Invite your network to grow together and unlock exclusive cooperative bonuses.</p>
          
          <div className="ref-codes-list" style={{ marginTop: '30px' }}>
            {codesToDisplay.length === 0 ? (
              <div className="ref-glass-card" style={{ textAlign: 'center', padding: '30px' }}>
                <FaInfoCircle style={{ fontSize: '2rem', color: '#cbd5e1', marginBottom: '15px' }} />
                <h4 style={{ color: '#fff', marginBottom: '10px' }}>No Referral Codes Yet</h4>
                <p style={{ color: '#94a3b8' }}>Subscribe to a Silver or Crest savings plan to generate your referral codes.</p>
              </div>
            ) : (
              codesToDisplay.map((c) => (
                <div key={c.code} className="ref-glass-card" style={{ marginBottom: '20px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                    <h4 style={{ margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FaStar style={{color: '#facc15'}} /> {c.plan_name} Account
                    </h4>
                    {c.status === 'locked' && <span className="badge-status pending" style={{margin: 0}}><FaLock /> Locked 🔒</span>}
                    {c.status === 'used' && <span className="badge-status disqualified" style={{margin: 0}}><FaTimesCircle /> Used</span>}
                    {c.status === 'expired' && <span className="badge-status disqualified" style={{margin: 0}}><FaTimesCircle /> Expired</span>}
                    {c.status === 'available' && <span className="badge-status active" style={{margin: 0}}><FaCheckCircle /> Available</span>}
                  </div>
                  
                  {c.status === 'locked' ? (
                    <div className="ref-locked-state" style={{ padding: 0, background: 'none' }}>
                      <p style={{ margin: '0 0 10px 0' }}>This referral code unlocks on {c.unlock_date ? new Date(c.unlock_date).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'N/A'}</p>
                      <div className="ref-input-wrapper">
                        <input type="text" value={`Code: ${c.code} (LOCKED)`} disabled style={{ backgroundColor: 'rgba(0,0,0,0.2)' }} />
                        <button disabled className="ref-copy-btn" style={{ opacity: 0.5 }}><FaCopy /> Copy</button>
                      </div>
                    </div>
                  ) : c.status === 'used' ? (
                    <div className="ref-locked-state" style={{ padding: 0, background: 'none' }}>
                      <p style={{ margin: '0 0 10px 0', color: '#cbd5e1' }}>This referral code has already been used and cannot be reused.</p>
                      <div className="ref-input-wrapper">
                        <input type="text" value={`Code: ${c.code} (USED)`} disabled style={{ backgroundColor: 'rgba(0,0,0,0.2)', textDecoration: 'line-through' }} />
                        <button disabled className="ref-copy-btn" style={{ opacity: 0.5 }}><FaCopy /> Copy</button>
                      </div>
                    </div>
                  ) : c.status === 'expired' ? (
                    <div className="ref-locked-state" style={{ padding: 0, background: 'none' }}>
                      <p style={{ margin: '0 0 10px 0', color: '#ef4444' }}>This referral code has expired.</p>
                      <div className="ref-input-wrapper">
                        <input type="text" value={`Code: ${c.code} (EXPIRED)`} disabled style={{ backgroundColor: 'rgba(0,0,0,0.2)' }} />
                        <button disabled className="ref-copy-btn" style={{ opacity: 0.5 }}><FaCopy /> Copy</button>
                      </div>
                    </div>
                  ) : (
                    <div className="ref-unlocked-state" style={{ padding: 0, background: 'none' }}>
                      <p style={{ margin: '0 0 10px 0' }}>Share this link to invite a partner. <strong>Status: Active</strong></p>
                      <div className="ref-input-wrapper">
                        <input type="text" value={`${window.location.origin}/register?ref=${c.code}`} readOnly onClick={(e) => e.target.select()} style={{ backgroundColor: 'rgba(0,0,0,0.3)' }} />
                        <button className={`ref-copy-btn ${copied === c.code ? 'copied' : ''}`} onClick={() => handleCopyLink(c.code)}>
                          {copied === c.code ? <><FaCheckCircle /> Copied</> : <><FaCopy /> Copy</>}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
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
              {stats.isEligible ? 'ELIGIBLE' : 'STANDARD'}
              {stats.isEligible ? <span className="pill-qualified">BONUS</span> : <span className="pill-standard">BASE</span>}
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
                <p>Invite at least 1 partner with a Silver Plan. They must start an active plan.</p>
              </div>
            </div>
            <div className="ref-timeline-step">
              <div className="ref-timeline-icon"><FaStar /></div>
              <div className="ref-timeline-content">
                <h4>3. Earn Bonuses</h4>
                <p>Your referral activity is reviewed for bonuses upon plan maturity.</p>
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
                    <th>Code Used</th>
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
                        <td><span style={{background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', color: '#475569'}}>{downline.usedSpecificCode}</span></td>
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
