import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getMyPlans, getMyNotifications, markNotificationRead, markAllNotificationsRead, generateVirtualAccount, updateBvn } from '../../services/api';
import DepositModal from '../../components/DepositModal';
import MembershipPaywall from '../../components/MembershipPaywall';
import { FaEye, FaEyeSlash, FaBell, FaCheckDouble, FaTimes, FaWhatsapp, FaCopy, FaCheck, FaUniversity, FaWallet } from 'react-icons/fa';

import './Dashboard.css';

const DashboardHome = () => {
  const { user, logout, refreshProfile, updateUser } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hideBalances, setHideBalances] = useState(true);
  const [error, setError] = useState(null);
  const [birthdayDismissed, setBirthdayDismissed] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showAllNotifs, setShowAllNotifs] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveCopied, setReceiveCopied] = useState(null);
  const [vaLoading, setVaLoading] = useState(false);
  const [vaError, setVaError] = useState('');
  const [vaSuccess, setVaSuccess] = useState('');
  const [showBvnModal, setShowBvnModal] = useState(false);
  const [bvnValue, setBvnValue] = useState('');
  const [bvnError, setBvnError] = useState('');
  const [bvnSubmitting, setBvnSubmitting] = useState(false);
  const [bvnSuccess, setBvnSuccess] = useState('');

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setReceiveCopied(text);
    setTimeout(() => setReceiveCopied(null), 2000);
  };

  // Birthday check
  const isBirthday = user?.dob && (() => {
    const today = new Date();
    const dob = new Date(user.dob);
    return today.getMonth() === dob.getMonth() && today.getDate() === dob.getDate();
  })();

  const fetchPlans = async (hasMembership) => {
    if (!hasMembership && user?.role !== 'admin') {
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
    const init = async () => {
      const profile = await refreshProfile();
      const hasMembership = profile?.has_paid_membership ?? user?.hasPaidMembership;
      setProfileLoaded(true);
      fetchPlans(hasMembership);
    };
    init();
  }, []);

  const handleDismissBirthday = () => {
    setBirthdayDismissed(true);
    sessionStorage.setItem('birthday_dismissed', 'true');
  };

  useEffect(() => {
    const bDismissed = sessionStorage.getItem('birthday_dismissed');
    if (bDismissed) setBirthdayDismissed(true);
  }, []);

  if (!profileLoaded) {
    return <div className="loading-container" style={{ textAlign: 'center', padding: '80px 20px' }}><div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #e1e1e1', borderTop: '4px solid #800020', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }}></div><p>Loading your profile...</p></div>;
  }

  if (user?.role === 'admin') {
    // Admin bypasses paywall
  } else if (!user?.hasPaidMembership || error === 'membership_required') {
    return <MembershipPaywall user={user} />;
  }

  const totalSavings = plans.reduce((sum, p) => sum + parseFloat(p.current_amount || 0), 0);
  const activePlans = plans.filter(p => p.status === 'active');
  const clearancePlans = plans.filter(p => p.status === 'pending_clearance');
  const paidPlans = plans.filter(p => p.status === 'completed');
  const savingsPlans = plans.filter(p => p.plan_type === 'savings');
  const walletBalance = parseFloat(user?.walletBalance || user?.wallet_balance || 0);
  const totalEarning = parseFloat(user?.total_earning || 0);

  const oldestPlan = plans.reduce((oldest, p) => {
    if (!oldest) return p;
    return new Date(p.created_at) < new Date(oldest.created_at) ? p : oldest;
  }, null);

  const oldestPlanDate = oldestPlan ? new Date(oldestPlan.created_at) : null;



  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleOpenDeposit = (plan) => {
    setSelectedPlan(plan);
    setIsModalOpen(true);
  };

  const handleGenerateVA = async () => {
    setVaLoading(true);
    setVaError('');
    setVaSuccess('');
    try {
      const { data } = await generateVirtualAccount();
      if (data.virtual_account_number) {
        updateUser({
          virtual_account_number: data.virtual_account_number,
          virtual_account_name: data.virtual_account_name,
          virtual_bank_name: data.virtual_bank_name,
        });
        setVaSuccess('Virtual account generated successfully!');
      }
    } catch (err) {
      setVaError(err.response?.data?.message || 'Failed to generate virtual account. Please try again.');
    } finally {
      setVaLoading(false);
    }
  };

  const handleBvnSubmit = async () => {
    if (bvnValue.length !== 11) { setBvnError('BVN must be 11 digits'); return; }
    setBvnSubmitting(true);
    setBvnError('');
    setBvnSuccess('');
    try {
      await updateBvn(bvnValue);
      updateUser({ bvn: bvnValue });
      setBvnSuccess('BVN saved! Generating your virtual account...');
      setShowBvnModal(false);
      setTimeout(() => handleGenerateVA(), 1000);
    } catch (err) {
      setBvnError(err.response?.data?.message || 'Failed to save BVN');
    } finally {
      setBvnSubmitting(false);
    }
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

        </div>

        {/* ─── Community Banner ─── */}
        {plans.length > 0 && (
          <div className="dashboard-section community-banner" style={{ background: 'rgba(37, 211, 102, 0.1)', border: '1px solid #25D366', borderRadius: '12px', padding: '15px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
            <div>
              <h3 style={{ margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#128c7e', fontSize: '1.1rem' }}>
                <FaWhatsapp size={20} /> Join the Official Palm Merit Community
              </h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#4b5563' }}>Stay updated, connect with members, and receive real-time support in our WhatsApp group.</p>
            </div>
            <a 
              href="https://chat.whatsapp.com/DLN74m6izwkJOyvcADozKF?mode=gi_t" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn"
              style={{ background: '#25D366', color: 'white', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.9rem', textDecoration: 'none', boxShadow: '0 2px 4px rgba(37, 211, 102, 0.2)' }}
            >
              <FaWhatsapp size={16} /> Join Group
            </a>
          </div>
        )}



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


        {/* ─── Notifications Feed ─── */}
        {notifications.length > 0 && (
          <div className="dashboard-section" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
                <FaBell style={{ color: 'var(--color-primary)' }} />
                Notifications
                {notifications.filter(n => !n.is_read).length > 0 && (
                  <span style={{ background: '#e74c3c', color: '#fff', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '20px', fontWeight: 'bold' }}>
                    {notifications.filter(n => !n.is_read).length} new
                  </span>
                )}
              </h3>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {notifications.some(n => !n.is_read) && (
                  <button onClick={handleMarkAllRead} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '600' }}>
                    <FaCheckDouble /> Mark all read
                  </button>
                )}
                <button onClick={() => setShowAllNotifs(!showAllNotifs)} style={{ background: 'none', border: '1px solid #cbd5e1', padding: '4px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '0.8rem', color: '#475569' }}>
                  {showAllNotifs ? 'Show Recent' : `View All (${notifications.length})`}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(showAllNotifs ? notifications : notifications.slice(0, 5)).map(notif => {
                const typeStyles = {
                  SYSTEM: { icon: '📢', bg: '#eef2ff', border: '#c7d2fe', color: '#4338ca' },
                  PAYMENT: { icon: '💳', bg: '#ecfdf5', border: '#a7f3d0', color: '#065f46' },
                  PROMO: { icon: '✨', bg: '#fefce8', border: '#fde68a', color: '#92400e' },
                  ALERT: { icon: '⚠️', bg: '#fef2f2', border: '#fecaca', color: '#991b1b' },
                };
                const style = typeStyles[notif.type] || typeStyles.SYSTEM;
                return (
                  <div key={notif.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '12px',
                    padding: '14px 16px', borderRadius: '10px',
                    background: notif.is_read ? '#f8fafc' : style.bg,
                    border: `1px solid ${notif.is_read ? '#e2e8f0' : style.border}`,
                    opacity: notif.is_read ? 0.75 : 1,
                    transition: 'all 0.2s ease'
                  }}>
                    <span style={{ fontSize: '1.3rem', marginTop: '2px' }}>{style.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                        <strong style={{ color: notif.is_read ? '#64748b' : style.color, fontSize: '0.95rem' }}>{notif.title}</strong>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                          {new Date(notif.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: notif.is_read ? '#94a3b8' : '#475569', lineHeight: '1.5' }}>{notif.message}</p>
                    </div>
                    {!notif.is_read && (
                      <button onClick={() => handleMarkRead(notif.id)} title="Mark as read" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.9rem', padding: '4px', marginTop: '2px', flexShrink: 0 }}>
                        <FaTimes />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}


        {/* ─── Unified Stats Row ─── */}
        <div className="stats-grid stats-grid-counts" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
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
          <div
            className="stat-card count-card"
            onClick={() => setShowReceiveModal(true)}
            style={{ cursor: 'pointer', background: 'linear-gradient(135deg, #059669, #047857)', color: 'white' }}
          >
            <div className="stat-icon" style={{ background: 'rgba(255,255,255,0.2)' }}>🏦</div>
            <h3 style={{ color: '#FFD700' }}>Receive Funds</h3>
            <div className="stat-count" style={{ color: '#FFFFFF', textShadow: '0 2px 8px rgba(0,0,0,0.3)', fontSize: '0.9rem' }}>
              {user?.virtual_account_number ? 'Tap to view account' : 'Tap to generate'}
            </div>
          </div>
          <div className="stat-card count-card" style={{
            background: user?.savingsStatus === 'defaulted' ? 'linear-gradient(135deg, #dc2626, #991b1b)' : 'linear-gradient(135deg, #059669, #047857)',
            color: 'white'
          }}>
            <div className="stat-icon" style={{ background: 'rgba(255,255,255,0.2)' }}>
              {user?.savingsStatus === 'defaulted' ? '⚠️' : '✅'}
            </div>
            <h3 style={{ color: '#FFD700' }}>Savings Status</h3>
            <div className="stat-count" style={{ color: '#FFFFFF', textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
              {user?.savingsStatus === 'defaulted' ? 'Defaulted' : 'Active'}
            </div>
            {user?.outstandingDefault > 0 && (
              <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', opacity: 0.9 }}>
                Outstanding Default: ₦{Number(user.outstandingDefault).toLocaleString()}
              </p>
            )}
          </div>
          <div className="stat-card count-card">
            <div className="stat-icon">📈</div>
            <h3>My Contributions (7 Days)</h3>
            <div className="stat-count">{recentTransactions.length}</div>
          </div>
        </div>

        {/* ─── Virtual Account Card ─── */}
        {user?.virtual_account_number && (
          <div className="virtual-account-card" style={{ marginBottom: '20px', padding: '18px 22px', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <span style={{ fontSize: '2rem' }}>🏦</span>
              <div>
                <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem', color: '#0f172a' }}>Your Virtual Account</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                  <strong>{user.virtual_account_number}</strong> — {user.virtual_bank_name}
                </p>
              </div>
            </div>
            <Link to="/dashboard/wallet" className="btn btn-sm btn-primary" style={{ padding: '8px 20px', fontSize: '0.85rem', textDecoration: 'none' }}>
              View Details
            </Link>
          </div>
        )}

        {/* ─── What's Up This Week ─── */}
        <div className="dashboard-section whats-up-section">
          <div className="section-header">
            <h3>🗓️ What's up This Week</h3>
          </div>
          <p className="whats-up-subtitle">
            Total <strong>{activePlans.length}</strong> active cooperative program{activePlans.length !== 1 ? 's' : ''}
          </p>

          {clearancePlans.length > 0 && (
            <div className="clearance-notice" style={{
              background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
              border: '1px solid #f59e0b',
              borderRadius: '10px',
              padding: '16px 20px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.5rem' }}>🔓</span>
                <div style={{ flex: 1 }}>
                  <strong style={{ color: '#92400e', fontSize: '0.95rem' }}>
                    {clearancePlans.reduce((s, p) => s + ((p.number_of_accounts || 1) - (p.accounts_cleared || 0)), 0)} account{(clearancePlans.reduce((s, p) => s + ((p.number_of_accounts || 1) - (p.accounts_cleared || 0)), 0)) !== 1 ? 's' : ''} available for clearance
                  </strong>
                  <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#78350f' }}>
                    {clearancePlans.map(p => `${p.plan_name} (${(p.number_of_accounts || 1) - (p.accounts_cleared || 0)} remaining)`).join(', ')}
                  </p>
                </div>
                <Link to="/dashboard/clearance" className="btn btn-sm btn-primary" style={{ textDecoration: 'none', padding: '8px 20px', whiteSpace: 'nowrap' }}>
                  Proceed to Clearance
                </Link>
              </div>
            </div>
          )}

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

      {/* ─── Receive Funds Modal ─── */}
      {showReceiveModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={() => setShowReceiveModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '480px', overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ background: 'linear-gradient(135deg, #800020, #4a0012)', padding: '24px 24px 20px', color: 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FaWallet size={22} style={{ color: '#FFD700' }} />
                  <h3 style={{ margin: 0, color: '#FFD700', fontSize: '1.15rem', fontWeight: 'bold' }}>Receive Funds</h3>
                </div>
                <button onClick={() => setShowReceiveModal(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FaTimes />
                </button>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: '0.85rem', opacity: 0.85 }}>Transfer money to your dedicated account</p>
            </div>
            <div style={{ padding: '24px' }}>
              {user?.virtual_account_number ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <label style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>Account Number</label>
                    <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#0f172a', fontFamily: 'monospace', marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>{user.virtual_account_number}</span>
                      <button
                        onClick={() => handleCopy(user.virtual_account_number)}
                        style={{ background: receiveCopied === user.virtual_account_number ? '#d4edda' : '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem', color: receiveCopied === user.virtual_account_number ? '#155724' : '#475569', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '600', transition: 'all 0.2s' }}
                      >
                        {receiveCopied === user.virtual_account_number ? <><FaCheck /> Copied</> : <><FaCopy /> Copy</>}
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <label style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>Bank Name</label>
                      <div style={{ fontSize: '1rem', fontWeight: '600', color: '#0f172a', marginTop: '4px' }}>{user.virtual_bank_name || 'Lotus Bank'}</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <label style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>Account Name</label>
                      <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#0f172a', marginTop: '4px' }}>{user.virtual_account_name || `${user.firstName} ${user.lastName}`}</div>
                    </div>
                  </div>
                  <div style={{ background: '#ecfdf5', padding: '12px 16px', borderRadius: '8px', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FaCheck style={{ color: '#059669', flexShrink: 0 }} />
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#065f46' }}>Your wallet will be credited automatically after transfer.</p>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  {vaSuccess && <div style={{ background: '#d4edda', color: '#155724', padding: '10px 14px', borderRadius: '8px', marginBottom: '12px', fontSize: '0.85rem' }}>✅ {vaSuccess}</div>}
                  {vaError && <div style={{ background: '#f8d7da', color: '#721c24', padding: '10px 14px', borderRadius: '8px', marginBottom: '12px', fontSize: '0.85rem' }}>❌ {vaError}</div>}
                  {user?.bvn ? (
                    <>
                      <FaUniversity style={{ fontSize: '2.5rem', color: '#cbd5e1', marginBottom: '12px' }} />
                      <p style={{ color: '#64748b', marginBottom: '14px', fontSize: '0.9rem' }}>Get a dedicated bank account to receive transfers.</p>
                      <button onClick={handleGenerateVA} className="btn btn-primary" disabled={vaLoading} style={{ padding: '10px 24px', fontSize: '0.95rem', borderRadius: '8px' }}>
                        {vaLoading ? 'Generating...' : '🏦 Generate Virtual Account'}
                      </button>
                    </>
                  ) : (
                    <>
                      <FaUniversity style={{ fontSize: '2.5rem', color: '#cbd5e1', marginBottom: '12px' }} />
                      <p style={{ color: '#64748b', marginBottom: '14px', fontSize: '0.9rem' }}>Provide your BVN to generate a dedicated virtual account.</p>
                      <button onClick={() => { setShowReceiveModal(false); setShowBvnModal(true); }} className="btn btn-primary" style={{ padding: '10px 24px', fontSize: '0.95rem', borderRadius: '8px' }}>
                        Provide BVN
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── BVN Modal ─── */}
      {showBvnModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={() => setShowBvnModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '420px', overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ background: 'linear-gradient(135deg, #800020, #4a0012)', padding: '20px 24px', color: 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#FFD700', fontSize: '1.1rem' }}>Enter Your BVN</h3>
                <button onClick={() => setShowBvnModal(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FaTimes />
                </button>
              </div>
            </div>
            <div style={{ padding: '24px' }}>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '16px' }}>Enter your 11-digit Bank Verification Number to generate your virtual account.</p>
              {bvnError && <div style={{ background: '#f8d7da', color: '#721c24', padding: '10px 14px', borderRadius: '8px', marginBottom: '12px', fontSize: '0.85rem' }}>❌ {bvnError}</div>}
              {bvnSuccess && <div style={{ background: '#d4edda', color: '#155724', padding: '10px 14px', borderRadius: '8px', marginBottom: '12px', fontSize: '0.85rem' }}>✅ {bvnSuccess}</div>}
              <input
                type="text"
                value={bvnValue}
                onChange={(e) => { setBvnValue(e.target.value.replace(/\D/g, '').slice(0, 11)); setBvnError(''); }}
                placeholder="Enter 11-digit BVN"
                maxLength={11}
                style={{ width: '100%', padding: '12px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '1.1rem', fontFamily: 'monospace', letterSpacing: '3px', textAlign: 'center', boxSizing: 'border-box' }}
              />
              <button
                onClick={handleBvnSubmit}
                disabled={bvnSubmitting || bvnValue.length !== 11}
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '16px', padding: '12px', fontSize: '1rem', borderRadius: '8px', opacity: bvnValue.length !== 11 ? 0.5 : 1 }}
              >
                {bvnSubmitting ? 'Saving...' : 'Save BVN'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>

  );
};

export default DashboardHome;
