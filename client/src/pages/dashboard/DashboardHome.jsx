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

    return (
      <div className="kyc-warning-banner" style={{ background: 'rgba(52, 152, 219, 0.1)', borderLeft: '4px solid #3498db', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <p style={{ color: '#2980b9', margin: 0 }}>
          🌱 <strong>KYC is Optional!</strong> You can save, fund, and run programs freely without completing KYC.
        </p>
        <Link to="/dashboard/kyc" className="btn btn-sm btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>Verify Now (Optional)</Link>
      </div>
    );
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
                  <div className="package-progress-card" key={plan.id} style={{ border: '1px solid #e2e8f0', boxShadow: '0 8px 25px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                    <div className="pkg-header" style={{ background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)', padding: '20px', borderBottom: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <h4 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>
                          {plan.plan_name} Programme 
                          {plan.number_of_accounts > 1 && <span style={{ marginLeft: '10px', fontSize: '0.85rem', background: '#e2e8f0', padding: '3px 8px', borderRadius: '20px', color: '#475569' }}>{plan.number_of_accounts} Accounts</span>}
                        </h4>
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Schedule: {plan.preferred_day || (plan.plan_name === 'ISUSU' ? 'Daily' : 'Friday')}</span>
                      </div>
                      <div className="pkg-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span className="badge badge-success" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>Active</span>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleOpenDeposit(plan)}
                          style={{ padding: '8px 16px', boxShadow: '0 4px 10px rgba(128,0,32,0.2)' }}
                        >
                          Add Funds
                        </button>
                      </div>
                    </div>

                    <div style={{ padding: '20px' }}>
                      <div className="accounts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                        {Array.from({ length: plan.number_of_accounts || 1 }).map((_, idx) => (
                          <div key={idx} className="account-sub-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px', transition: 'transform 0.2s ease, box-shadow 0.2s ease', cursor: 'default' }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 15px rgba(0,0,0,0.05)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px dashed #cbd5e1', paddingBottom: '10px' }}>
                              <h5 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ background: 'rgba(128,0,32,0.1)', color: 'var(--color-primary)', width: '24px', height: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: '0.8rem' }}>{idx + 1}</span>
                                Account
                              </h5>
                              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold' }}>{progress}%</span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                <span style={{ color: '#64748b' }}>Target Savings</span>
                                <strong style={{ color: '#0f172a' }}>{formatCurrency(individualTarget)}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                <span style={{ color: '#64748b' }}>{plan.plan_name === 'ISUSU' ? 'Daily Savings' : 'Weekly Savings'}</span>
                                <strong style={{ color: '#0f172a' }}>{getWeeklySavingsAmount(plan.plan_name)}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                <span style={{ color: '#64748b' }}>Remaining Balance</span>
                                <strong style={{ color: '#ff781f' }}>{formatCurrency(individualRemaining)}</strong>
                              </div>
                            </div>

                            <div className="progress-wrapper" style={{ marginTop: '20px' }}>
                              <div className="progress-info" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '8px', color: '#475569' }}>
                                <span><strong>{formatCurrency(individualSaved)}</strong> saved of <strong>{formatCurrency(individualTarget)}</strong></span>
                              </div>
                              <div className="progress-bar" style={{ height: '8px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden' }}>
                                <div className="progress-fill" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #800020, #e60039)', height: '100%', borderRadius: '10px' }}></div>
                              </div>
                            </div>
                          </div>
                        ))}
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
