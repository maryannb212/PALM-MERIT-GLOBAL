import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getMyPlans, getMyNotifications, markNotificationRead, markAllNotificationsRead } from '../../services/api';
import DepositModal from '../../components/DepositModal';
import MembershipPaywall from '../../components/MembershipPaywall';
import { FaEye, FaEyeSlash, FaBell, FaCheckDouble, FaTimes, FaWhatsapp, FaPlus, FaExchangeAlt, FaBoxOpen, FaReceipt } from 'react-icons/fa';

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
  const [dismissedNotifications, setDismissedNotifications] = useState([]);
  const [showAllNotifs, setShowAllNotifs] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
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

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const { data } = await getMyNotifications();
        setNotifications(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching notifications:', err);
      }
    };
    fetchNotifications();
  }, []);

  const handleMarkRead = async (notifId) => {
    try {
      await markNotificationRead(notifId);
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Error marking all notifications read:', err);
    }
  };

  const handleDismissNotification = (notifId) => {
    setDismissedNotifications(prev => [...prev, notifId]);
  };

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
    <div className="dashboard-home">
        {/* ─── Dashboard Header ─── */}
        <div className="welcome-card">
          <div className="welcome-avatar">
            {user?.profileImage ? (
              <img src={user.profileImage} alt="" />
            ) : (
              user?.firstName?.charAt(0)?.toUpperCase()
            )}
          </div>
          <div className="welcome-text">
            <span className="dashboard-kicker">MEMBER OVERVIEW</span>
            <h2>Welcome back, {user?.firstName} {user?.lastName}</h2>
            <p>{new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} <span className="welcome-divider">•</span> Keep building your future.</p>
          </div>
          <div className="welcome-tools">
            <button type="button" className="notification-trigger" aria-label="View notifications" title="View notifications" onClick={() => setShowAllNotifs(!showAllNotifs)}>
              <FaBell />
              <span className={`notification-count ${notifications.filter(n => !n.is_read).length === 0 ? 'is-zero' : ''}`}>
                {notifications.filter(n => !n.is_read).length}
              </span>
            </button>
          </div>
          {showAllNotifs && createPortal((
            <div className="dashboard-home notification-portal">
              <div className="notification-overlay" role="dialog" aria-modal="true" aria-label="Notifications" onClick={() => setShowAllNotifs(false)}>
              <section className="notification-popover" onClick={(event) => event.stopPropagation()}>
                <div className="notification-popover-header">
                  <div><strong>Notifications</strong><span>{notifications.filter(n => !n.is_read).length} unread</span></div>
                  <div className="notification-header-actions">
                    {notifications.some(n => !n.is_read) && <button type="button" onClick={handleMarkAllRead}><FaCheckDouble /> Mark all read</button>}
                    <button type="button" className="notification-close-button" aria-label="Close notifications" onClick={() => setShowAllNotifs(false)}><FaTimes /></button>
                  </div>
                </div>
                <div className="notification-popover-list">
                  {notifications.filter(n => !dismissedNotifications.includes(n.id)).length === 0 ? (
                    <div className="notification-empty-state">You are all caught up.</div>
                  ) : notifications.filter(n => !dismissedNotifications.includes(n.id)).map(notif => {
                    const icon = notif.type === 'PAYMENT' ? '💳' : notif.type === 'ALERT' ? '⚠️' : notif.type === 'clearance' ? '🔓' : notif.type === 'payout' ? '💰' : '📢';
                    return (
                      <div className={`notification-popover-item ${notif.is_read ? 'is-read' : 'is-unread'}`} key={notif.id}>
                        <span className="notification-icon">{icon}</span>
                        <span className="notification-popover-copy"><strong>{notif.title}</strong><small>{notif.message}</small></span>
                        <time>{new Date(notif.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</time>
                        <div className="notification-popover-actions">
                          {!notif.is_read && <button type="button" className="notification-read-button" onClick={() => handleMarkRead(notif.id)}>Read</button>}
                          {notif.is_read && <button type="button" className="notification-dismiss-button" aria-label="Dismiss notification" title="Dismiss notification" onClick={() => handleDismissNotification(notif.id)}><FaTimes /></button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {notifications.length > 5 && <button type="button" className="notification-popover-footer" onClick={() => { setShowAllNotifs(false); navigate('/dashboard/settings'); }}>Manage all notifications</button>}
              </section>
              </div>
            </div>
          ), document.body)}
        </div>

        <div className="quick-actions" aria-label="Quick actions">
          <span className="quick-actions-label">Quick actions</span>
          <Link to="/dashboard/wallet" className="quick-action"><span className="quick-action-icon burgundy"><FaPlus /></span><span>Fund wallet</span></Link>
          <Link to="/dashboard/withdraw" className="quick-action"><span className="quick-action-icon emerald"><FaExchangeAlt /></span><span>Transfer</span></Link>
          <Link to="/dashboard/packages" className="quick-action"><span className="quick-action-icon gold"><FaBoxOpen /></span><span>Cooperative</span></Link>
          <Link to="/dashboard/receipt" className="quick-action"><span className="quick-action-icon slate"><FaReceipt /></span><span>Receipts</span></Link>
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
              href="https://chat.whatsapp.com/DpBczcQCHDX9vIVFVh0Omo?s=cl&p=a&ilr=4&amv=3" 
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
              {recentTransactions.map((plan) => {
                const statusLabels = {
                  active: 'Active', completed: 'Completed', cancelled: 'Cancelled',
                  maturity: 'Completed', eligibility_review: 'Completed',
                  pending_clearance: 'Pending Clearance', pending_settlement: 'Eligibility Review',
                  settled: 'Paid'
                };
                const displayStatus = statusLabels[plan.status] || plan.status;
                return (
                <div className="week-tx-row" key={plan.id}>
                  <span className="week-tx-name">{plan.plan_name}</span>
                  <span className={`badge badge-${plan.status === 'active' ? 'success' : 'warning'}`}>
                    {displayStatus}
                  </span>
                  <span className="week-tx-amount">{formatCurrency(plan.current_amount)}</span>
                </div>
                );
              })}
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
    </div>

  );
};

export default DashboardHome;
