import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getMyPlans } from '../../services/api';
import DepositModal from '../../components/DepositModal';
import MembershipPaywall from '../../components/MembershipPaywall';

import './Dashboard.css';

const DashboardHome = () => {
  const { user, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState(null);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const [announcementExpanded, setAnnouncementExpanded] = useState(false);
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

  // Check if announcement was dismissed this session
  useEffect(() => {
    const dismissed = sessionStorage.getItem('announcement_dismissed');
    if (dismissed) setAnnouncementDismissed(true);
  }, []);

  const handleDismissAnnouncement = () => {
    setAnnouncementDismissed(true);
    sessionStorage.setItem('announcement_dismissed', 'true');
  };

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
  const walletBalance = parseFloat(user?.wallet_balance || 0);
  const totalEarning = parseFloat(user?.total_earning || 0);

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

        {/* ─── Attention Announcement Modal ─── */}
        {!announcementDismissed && (
          <div className="announcement-overlay" onClick={handleDismissAnnouncement}>
            <div className="announcement-modal" onClick={(e) => e.stopPropagation()}>
              <div className="announcement-header">
                <div className="announcement-header-content">
                  <span className="announcement-icon">📢</span>
                  <span className="announcement-title">ATTENTION! ATTENTION!! ATTENTION!!!</span>
                </div>
                <button
                  className="announcement-close"
                  onClick={handleDismissAnnouncement}
                  aria-label="Dismiss announcement"
                >
                  ✕
                </button>
              </div>
              <div className="announcement-body">
                <p>
                  Dear Esteem subscriber, the reduction in the number of accounts each subscribers can
                  operate is in compliance with <strong>government policies and regulatory guidelines</strong>.
                  As we are all aware, similar limitations apply to our daily banking transactions, where
                  customers are restricted to certain transaction and account limits.
                </p>
                <p>
                  In the same way, each person on Palm Merit Global is limited to a specific number of
                  subscriptions (<strong>100</strong>) per month. In line with these policies, any account
                  more than 100 would only receive a full payment on 100 subscription and the remaining
                  subscription fee will be <strong>refunded</strong>.
                </p>
                <p className="announcement-note">
                  ⚠️ Be aware that you can only make use of the <strong>bulk clearance button</strong> during clearance.
                </p>
                <p className="announcement-footer">Thank you for your understanding and continued cooperation.<br/>— <em>Management</em></p>
              </div>
            </div>
          </div>
        )}

        {/* ─── KYC Banners ─── */}
        {user?.kycStatus === 'unverified' && (
          <div className="kyc-warning-banner">
            <p>👋 Welcome, <strong>{user?.firstName} {user?.lastName}</strong>! You have to complete your KYC to create a wallet and get started.</p>
            <Link to="/dashboard/kyc" className="btn btn-sm btn-warning">Complete KYC Now</Link>
          </div>
        )}

        {user?.kycStatus === 'pending' && (
          <div className="kyc-warning-banner pending">
            <p>⏳ Your KYC verification is <strong>in progress</strong>. You will be notified once our team reviews your details.</p>
            <span className="badge badge-warning">Pending Approval</span>
          </div>
        )}

        {user?.kycStatus === 'verified' && (
          <div className="kyc-warning-banner" style={{ background: 'rgba(46, 204, 113, 0.1)', borderLeft: '4px solid #2ecc71' }}>
            <p style={{ color: '#2ecc71' }}>✅ <strong>KYC Verified</strong>. Your identity has been successfully verified by our compliance team.</p>
          </div>
        )}



        {/* ─── Unified Stats Row ─── */}
        <div className="stats-grid stats-grid-counts" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="stat-card count-card" style={{ background: 'linear-gradient(135deg, #800020, #4a0012)', color: 'white' }}>
            <div className="stat-icon" style={{ background: 'rgba(255,255,255,0.2)', color: '#FFD700' }}>✅</div>
            <h3 style={{ color: '#FFD700' }}>Active Cooperative Programs</h3>
            <div className="stat-count">{activePlans.length}</div>
          </div>
          <div className="stat-card count-card">
            <div className="stat-icon">👥</div>
            <h3>Total Members</h3>
            <div className="stat-count">{user?.totalMembers || 0}</div>
          </div>
          <div className="stat-card count-card">
            <div className="stat-icon">💰</div>
            <h3>Wallet Balance</h3>
            <div className="stat-count">
              <span className="stat-currency">₦</span>{formatCurrency(walletBalance).replace('₦', '').trim()}
            </div>
          </div>
          <div className="stat-card count-card">
            <div className="stat-icon">📈</div>
            <h3>Weekly Contributions</h3>
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
                return (
                  <div className="package-progress-card" key={plan.id}>
                    <div className="pkg-header">
                      <h4>{plan.plan_name} Programme</h4>
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
                    <div className="pkg-details">
                      <p>Target: {formatCurrency(plan.target_amount)}</p>
                      <p>Saved: {formatCurrency(plan.current_amount)}</p>
                    </div>
                    <div className="progress-wrapper">
                      <div className="progress-info">
                        <span>{formatCurrency(plan.current_amount)} of {formatCurrency(plan.target_amount)}</span>
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
