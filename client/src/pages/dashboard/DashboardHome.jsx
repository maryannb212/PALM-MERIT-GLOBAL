import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getMyPlans } from '../../services/api';
import DepositModal from '../../components/DepositModal';
import MembershipPaywall from '../../components/MembershipPaywall';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

import './Dashboard.css';

const DashboardHome = () => {
  const { user, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hideBalances, setHideBalances] = useState(true);
  const [error, setError] = useState(null);
  const [birthdayDismissed, setBirthdayDismissed] = useState(false);

  // Birthday check
  const isBirthday = user?.dob && (() => {
    const today = new Date();
    const dob = new Date(user.dob);
    return today.getMonth() === dob.getMonth() && today.getDate() === dob.getDate();
  })();

  const fetchPlans = async () => {
    if (!user?.hasPaidMembership && user?.role !== 'admin') {
      setLoading(false);
      return;
    }

    try {
      const { data } = await getMyPlans();
      setPlans(data);
    } catch (err) {
      console.error('Error fetching plans:', err);
      if (err.response?.status === 403 && err.response?.data?.requiresMembership) {
        setError('membership_required');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile(); // Always fetch latest profile (KYC status, membership, etc.)
    fetchPlans();
  }, []);

  const handleDismissBirthday = () => {
    setBirthdayDismissed(true);
    sessionStorage.setItem('birthday_dismissed', 'true');
  };

  useEffect(() => {
    const bDismissed = sessionStorage.getItem('birthday_dismissed');
    if (bDismissed) setBirthdayDismissed(true);
  }, []);

  if (user?.role === 'admin') {
    // Admin bypasses paywall
  } else if (!user?.hasPaidMembership || error === 'membership_required') {
    return <MembershipPaywall user={user} />;
  }

  const totalSavings = plans.reduce((sum, p) => sum + parseFloat(p.current_amount || 0), 0);
  const activePlans = plans.filter(p => p.status === 'active');
  const paidPlans = plans.filter(p => p.status === 'completed');
  const savingsPlans = plans.filter(p => p.plan_type === 'savings');
  const walletBalance = parseFloat(user?.walletBalance || user?.wallet_balance || 0);
  const totalEarning = parseFloat(user?.total_earning || 0);

  const oldestPlan = plans.reduce((oldest, p) => {
    if (!oldest) return p;
    return new Date(p.created_at) < new Date(oldest.created_at) ? p : oldest;
  }, null);

  const oldestPlanDate = oldestPlan ? new Date(oldestPlan.created_at) : null;
  const ninetyDaysInMs = 90 * 24 * 60 * 60 * 1000; // 90 days
  const elapsedMs = oldestPlanDate ? (new Date() - oldestPlanDate) : 0;
  const remainingDays = oldestPlanDate ? Math.max(0, Math.ceil((ninetyDaysInMs - elapsedMs) / (1000 * 60 * 60 * 24))) : 90;
  const isKycCompulsory = oldestPlanDate && (elapsedMs > ninetyDaysInMs);

  const renderKycGraceStatus = () => {
    if (user?.kycStatus === 'verified') {
      return (
        <div className="kyc-warning-banner" style={{ background: 'rgba(46, 204, 113, 0.1)', borderLeft: '4px solid #2ecc71' }}>
          <p style={{ color: '#2ecc71', margin: 0 }}>✅ <strong>KYC Verified</strong>. Your identity has been successfully verified by our compliance team.</p>
        </div>
      );
    }

    if (user?.kycStatus === 'pending') {
      return (
        <div className="kyc-warning-banner pending" style={{ borderLeft: '4px solid #f1c40f' }}>
          <p style={{ margin: 0 }}>⏳ Your KYC verification is <strong>in progress</strong>. You will be notified once our team reviews your details.</p>
          <span className="badge badge-warning" style={{ marginLeft: '10px' }}>Pending Approval</span>
        </div>
      );
    }

    if (isKycCompulsory) {
      return (
        <div className="kyc-warning-banner" style={{ background: 'rgba(231, 76, 60, 0.1)', borderLeft: '4px solid #e74c3c' }}>
          <p style={{ color: '#c0392b', margin: 0 }}>
            ⚠️ <strong>KYC Verification Required!</strong> It has been more than 3 months ({Math.ceil(elapsedMs / (1000 * 60 * 60 * 24))} days) since you started your first savings program. Complete your KYC now to keep your account in good standing.
          </p>
          <Link to="/dashboard/kyc" className="btn btn-sm btn-warning" style={{ marginLeft: '15px', color: '#000', fontWeight: 'bold' }}>Complete KYC Now</Link>
        </div>
      );
    } else {
      return (
        <div className="kyc-warning-banner" style={{ background: 'rgba(52, 152, 219, 0.1)', borderLeft: '4px solid #3498db', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <p style={{ color: '#2980b9', margin: 0 }}>
            🌱 <strong>KYC Optional!</strong> You can save, fund, and run programs freely. KYC is only required 3 months after starting your first program.
            {oldestPlanDate ? (
              <span> (<strong>{remainingDays} days remaining</strong> of your optional grace period).</span>
            ) : (
              <span> (Grace period of <strong>90 days</strong> starts once you subscribe to your first savings program).</span>
            )}
          </p>
          <Link to="/dashboard/kyc" className="btn btn-sm btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>Verify Now (Optional)</Link>
        </div>
      );
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleOpenDeposit = (plan) => {
    setSelectedPlan(plan);
    setIsModalOpen(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  const getPlanProgress = (plan) => {
    const target = parseFloat(plan.target_amount) || 1;
    const current = parseFloat(plan.current_amount) || 0;
    return Math.min(Math.round((current / target) * 100), 100);
  };

  // Get recent transactions (last 7 days) — derive from plans for now
  const recentTransactions = plans.filter(p => {
    const created = new Date(p.created_at);
    const now = new Date();
    const diffDays = (now - created) / (1000 * 60 * 60 * 24);
    return diffDays <= 7;
  });

  return (
    <>
        {/* ─── Welcome Card ─── */}
        <div className="welcome-card">
          <div className="welcome-avatar">
            {user?.profileImage ? (
              <img src={user.profileImage} alt="" />
            ) : (
              user?.firstName?.charAt(0)?.toUpperCase()
            )}
          </div>
          <div className="welcome-text">
            <h2>👋 Welcome back, {user?.firstName} {user?.lastName}!</h2>
            <p>Empowering your financial future — {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <div className="welcome-actions" style={{ marginLeft: 'auto' }}>
            <Link to="/dashboard/receipt" className="btn btn-burgundy-gold">
               Verify Manual Transfer
            </Link>
          </div>
        </div>

        {/* ─── Birthday Banner ─── */}
        {isBirthday && !birthdayDismissed && (
          <div className="birthday-banner" style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)', padding: '15px 20px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', color: '#000', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>🎉 Happy Birthday, {user?.firstName}! 🎂</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.9 }}>Wishing you a fantastic day and prosperous year ahead from the Palm Merit Global team.</p>
            </div>
            <button onClick={handleDismissBirthday} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: '#000', opacity: 0.7 }}>&times;</button>
          </div>
        )}



        {/* ─── KYC Banners ─── */}
        {renderKycGraceStatus()}



        {/* ─── Unified Stats Row ─── */}
        <div className="stats-grid stats-grid-counts" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          <div className="stat-card count-card" style={{ background: 'linear-gradient(135deg, #800020, #4a0012)', color: 'white' }}>
            <div className="stat-icon" style={{ background: 'rgba(255,255,255,0.2)', color: '#FFD700' }}>✅</div>
            <h3 style={{ color: '#FFD700' }}>Active Cooperative Programs</h3>
            <div className="stat-count" style={{ color: '#FFFFFF', textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>{activePlans.length}</div>
          </div>
          <div className="stat-card count-card" onClick={() => setHideBalances(!hideBalances)} style={{ cursor: 'pointer' }}>
            <div className="stat-icon">
              {hideBalances ? <FaEyeSlash /> : <FaEye />}
            </div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              Wallet Balance
              <button 
                onClick={(e) => { e.stopPropagation(); setHideBalances(!hideBalances); }}
                className="btn-link"
                style={{ background: 'none', border: 'none', padding: '0', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
              >
                ({hideBalances ? 'Show' : 'Hide'})
              </button>
            </h3>
            <div className="stat-count">
              {hideBalances ? (
                <span style={{ fontSize: '1.5rem', letterSpacing: '3px' }}>••••••</span>
              ) : (
                <>
                  <span className="stat-currency">₦</span>{formatCurrency(walletBalance).replace('₦', '').trim()}
                </>
              )}
            </div>
          </div>
          <div className="stat-card count-card">
            <div className="stat-icon">📈</div>
            <h3>My Contributions (7 Days)</h3>
            <div className="stat-count">{recentTransactions.length}</div>
          </div>
        </div>

        {/* ─── What's Up This Week ─── */}
        <div className="dashboard-section whats-up-section">
          <div className="section-header">
            <h3>🗓️ What's up This Week</h3>
          </div>
          <p className="whats-up-subtitle">
            Total <strong>{activePlans.length}</strong> active cooperative program{activePlans.length !== 1 ? 's' : ''}
          </p>
          {loading ? (
            <p className="text-muted">Loading activity...</p>
          ) : recentTransactions.length === 0 ? (
            <div className="no-record-state">
              <span className="no-record-icon">📭</span>
              <p>No Record of transactions</p>
            </div>
          ) : (
            <div className="week-transactions">
              {recentTransactions.map((plan) => (
                <div className="week-tx-row" key={plan.id}>
                  <span className="week-tx-name">{plan.plan_name}</span>
                  <span className={`badge badge-${plan.status === 'active' ? 'success' : 'warning'}`}>
                    {plan.status}
                  </span>
                  <span className="week-tx-amount">{formatCurrency(plan.current_amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Active Cooperative Programs ─── */}
        <div className="dashboard-section">
          <div className="section-header">
            <h3>Active Cooperative Programs</h3>
            <Link to="/dashboard/packages" className="btn btn-sm btn-secondary">New Program</Link>
          </div>
          {loading ? (
            <p className="text-muted">Loading your programs...</p>
          ) : activePlans.length === 0 ? (
            <div className="empty-state">
              <p>You have no active cooperative programs yet.</p>
              <Link to="/dashboard/packages" className="btn btn-primary">Browse Programs</Link>
            </div>
          ) : (
            <div className="packages-list">
              {activePlans.map((plan) => {
                const progress = getPlanProgress(plan);
                const individualTarget = parseFloat(plan.target_amount || 0) / (plan.number_of_accounts || 1);
                const individualSaved = parseFloat(plan.current_amount || 0) / (plan.number_of_accounts || 1);
                const individualRemaining = Math.max(0, individualTarget - individualSaved);

                const getWeeklySavingsAmount = (planName) => {
                  if (planName === 'CREST') return '₦4,000';
                  if (planName === 'SILVER') return '₦1,500';
                  if (planName === 'GOLDEN_BASKET') return '₦2,000';
                  if (planName === 'ISUSU') return '₦500 Daily (Min)';
                  return '₦500';
                };

                return (
                  <div className="package-progress-card" key={plan.id}>
                    <div className="pkg-header">
                      <h4>{plan.plan_name} Programme {plan.number_of_accounts > 1 && <span className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 'normal' }}>({plan.number_of_accounts} accounts)</span>}</h4>
                      <div className="pkg-actions">
                        <span className="badge badge-success">Active</span>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleOpenDeposit(plan)}
                          style={{ marginLeft: '10px' }}
                        >
                          Add Funds
                        </button>
                      </div>
                    </div>
                    <div className="pkg-details" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                      <p style={{ margin: 0 }}><strong>Target Savings:</strong> {formatCurrency(individualTarget)}</p>
                      <p style={{ margin: 0 }}><strong>{plan.plan_name === 'ISUSU' ? 'Daily Savings:' : 'Weekly Savings:'}</strong> {getWeeklySavingsAmount(plan.plan_name)}</p>
                      <p style={{ margin: 0 }}><strong>Schedule:</strong> {plan.preferred_day || (plan.plan_name === 'ISUSU' ? 'Daily' : 'Friday')}</p>
                      <p style={{ margin: 0 }}><strong>Remaining Balance:</strong> {formatCurrency(individualRemaining)}</p>
                    </div>
                    <div className="progress-wrapper" style={{ marginTop: '15px' }}>
                      <div className="progress-info">
                        <span>{formatCurrency(individualSaved)} saved of {formatCurrency(individualTarget)} target</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Footer ─── */}
        <footer className="dashboard-footer">
          <p>2026© Palm Merit Global</p>
          <nav className="footer-nav">
            <Link to="/dashboard">Home</Link>
          </nav>
        </footer>

      {selectedPlan && (
        <DepositModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          plan={selectedPlan}
          onSuccess={fetchPlans}
        />
      )}
    </>

  );
};

export default DashboardHome;
