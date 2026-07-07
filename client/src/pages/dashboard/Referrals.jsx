import React, { useState, useEffect } from 'react';
import API from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { 
  FaLock, FaUnlock, FaCopy, FaCheckCircle, FaUserFriends, 
  FaUserCheck, FaTimesCircle, FaExclamationTriangle,
  FaShieldAlt, FaInfoCircle, FaCalendarAlt, FaStar, FaChartLine,
  FaMoneyBillWave, FaCoins, FaArrowRight
} from 'react-icons/fa';
import './Dashboard.css';
import './Referrals.css';

const PLAN_CONFIG = {
  CREST: { amount: 4000, isDaily: false, color: '#800020', label: 'CREST' },
  SILVER: { amount: 1500, isDaily: false, color: '#64748b', label: 'SILVER' },
  GOLDEN_BASKET: { amount: 2000, isDaily: false, color: '#d97706', label: 'GOLDEN BASKET' },
  ISUSU: { amount: 500, isDaily: true, color: '#059669', label: 'ISUSU' }
};

const getNextPaymentDate = (plan) => {
  const config = PLAN_CONFIG[plan.plan_name];
  if (!config) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (config.isDaily) {
    const next = new Date(today);
    next.setDate(next.getDate() + 1);
    return next;
  }
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDay = plan.preferred_day || daysOfWeek[(new Date(plan.start_date).getDay() + 6) % 7];
  const targetIndex = daysOfWeek.findIndex(d => d.toLowerCase() === targetDay.toLowerCase());
  if (targetIndex === -1) return null;
  const next = new Date(today);
  next.setDate(next.getDate() + ((targetIndex + 7 - next.getDay()) % 7));
  if (next <= today) next.setDate(next.getDate() + 7);
  return next;
};

const countContributions = (startDate, preferredDay, isDaily) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  if (start >= today) return 0;
  if (isDaily) {
    return Math.floor((today - start) / (1000 * 60 * 60 * 24));
  }
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDayIndex = daysOfWeek.findIndex(d => d.toLowerCase() === (preferredDay || '').toLowerCase());
  if (targetDayIndex === -1) {
    return Math.floor((today - start) / (1000 * 60 * 60 * 24 * 7));
  }
  let count = 0;
  const cursor = new Date(start);
  if (cursor.getDay() !== targetDayIndex) {
    count = 1;
    while (cursor.getDay() !== targetDayIndex) {
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  while (cursor < today) {
    count++;
    cursor.setDate(cursor.getDate() + 7);
  }
  return count;
};

const Referrals = () => {
  const { user, refreshProfile } = useAuth();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
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
    const fetchData = async () => {
      try {
        setLoading(true);
        const refRes = await API.get('/auth/referrals');
        setStats(refRes.data);
      } catch (err) {
        console.error('Error fetching referrals:', err);
        setError('Failed to load data. Please verify your connection or try again.');
      }
      try {
        const plansRes = await API.get('/savings/my-plans');
        setPlans(plansRes.data || []);
      } catch (err) {
        if (err.response?.status === 403) {
          setPlans([]);
        } else {
          console.error('Error fetching savings plans:', err);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const legacyCode = user?.referralCode || 'NOT-AVAILABLE';
  const codesToDisplay = stats.myCodes && stats.myCodes.length > 0 
    ? stats.myCodes 
    : (user?.referralCode ? [{
        code: legacyCode,
        plan_name: 'Legacy Account',
        status: 'available',
        unlock_date: null
      }] : []);

  const handleCopyLink = (code) => {
    navigator.clipboard.writeText(code);
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
                      <p style={{ margin: '0 0 10px 0' }}>Share this code with a partner. <strong>Status: Active</strong></p>
                      <div className="ref-input-wrapper">
                        <input type="text" value={c.code} readOnly onClick={(e) => e.target.select()} style={{ backgroundColor: 'rgba(0,0,0,0.3)', fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', textAlign: 'center' }} />
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

      {/* My Savings Plans Section */}
      <div className="ref-plans-section">
        <div className="ref-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FaCoins color="#800020" /> My Savings Plans
            </h3>
            <span style={{ background: '#f1f5f9', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold' }}>
              {plans.length} Plan{plans.length !== 1 ? 's' : ''}
            </span>
          </div>

          {plans.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <FaMoneyBillWave style={{ fontSize: '3rem', color: '#cbd5e1', margin: '0 auto 15px', display: 'block' }} />
              <h4 style={{ color: '#64748b' }}>No active savings plans</h4>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Subscribe to a savings plan to see your plans here.</p>
            </div>
          ) : (
            <div className="ref-table-wrapper">
              <table className="ref-premium-table ref-plans-table">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Cycle</th>
                    <th>Next Payment</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan) => {
                    const config = PLAN_CONFIG[plan.plan_name];
                    const installmentAmount = (config?.amount || 0) * (plan.number_of_accounts || 1);
                    const isDaily = config?.isDaily || false;
                    const contributions = countContributions(plan.start_date || plan.created_at, plan.preferred_day, isDaily);
                    const nextPayDate = getNextPaymentDate(plan);
                    const progress = plan.target_amount > 0 ? ((plan.current_amount / plan.target_amount) * 100).toFixed(1) : 0;
                    const status = plan.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    return (
                      <tr key={plan.id}>
                        <td>
                          <span className="plan-pill" style={{
                            background: config?.color ? `${config.color}15` : '#f1f5f9',
                            color: config?.color || '#475569',
                            fontWeight: '700'
                          }}>
                            {plan.plan_name === 'GOLDEN_BASKET' ? 'Golden Basket' : plan.plan_name?.charAt(0) + plan.plan_name?.slice(1).toLowerCase()}
                          </span>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {new Date(plan.start_date || plan.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {plan.maturity_date || plan.end_date
                            ? new Date(plan.maturity_date || plan.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            : <span style={{ color: '#94a3b8' }}>—</span>}
                        </td>
                        <td>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FaCalendarAlt style={{ color: '#64748b', fontSize: '0.8rem' }} />
                            <span><strong style={{ color: '#800020' }}>#{contributions}</strong> {isDaily ? 'Daily' : plan.preferred_day || 'Weekly'}</span>
                          </span>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {nextPayDate ? (
                            <span title={nextPayDate.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}>
                              ₦{installmentAmount.toLocaleString()} <br />
                              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                {nextPayDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                              </span>
                            </span>
                          ) : <span style={{ color: '#94a3b8' }}>—</span>}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontWeight: '600', color: '#0f172a' }}>
                              ₦{Number(plan.current_amount || 0).toLocaleString()} <span style={{ color: '#94a3b8', fontWeight: '400' }}>/ ₦{Number(plan.target_amount || 0).toLocaleString()}</span>
                            </span>
                            <div style={{ width: '100%', height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{
                                width: `${Math.min(progress, 100)}%`,
                                height: '100%',
                                background: config?.color || '#800020',
                                borderRadius: '2px',
                                transition: 'width 0.3s ease'
                              }} />
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{progress}%</span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge-status ${plan.status === 'active' ? 'active' : plan.status === 'completed' || plan.status === 'matured' ? 'qualified' : plan.status === 'cancelled' ? 'disqualified' : 'pending'}`}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
                            [...new Set(downline.plans.filter(p => p.planName !== 'GOLDEN_BASKET').map(p => p.planName))].map(name => (
                              <span key={name} className="plan-pill">{name}</span>
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
