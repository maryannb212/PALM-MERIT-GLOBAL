import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getAdminStats, getRecentTransfers, getMaturitySummary, runMaturityCheck, getAdminNotifications, markAdminNotificationRead, markAllAdminNotificationsRead } from '../../services/api';
import { FaUsers, FaUserCheck, FaExclamationTriangle, FaMoneyBillWave, FaArrowRight, FaChartPie, FaGavel, FaBullhorn, FaPiggyBank, FaUserFriends, FaLink, FaCreditCard, FaSyncAlt, FaClipboardCheck, FaBell, FaCheckDouble, FaTimes } from 'react-icons/fa';
import '../dashboard/Dashboard.css';
import './Admin.css';
import { createPortal } from 'react-dom';

const AdminDashboard = () => {
  const { admin } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    usersToday: 0,
    verifiedUsers: 0,
    pendingKYC: 0,
    activeSubscriptions: 0,
    totalVolume: 0,
    openTickets: 0,
    totalDownlines: 0,
    totalReferralCodes: 0,
    recentUsers: []
  });
  const [recentTransfers, setRecentTransfers] = useState([]);
  const [maturitySummary, setMaturitySummary] = useState({ eligibility_review: 0, pending_clearance: 0, pending_settlement: 0 });
  const [maturityRunning, setMaturityRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [showAllNotifs, setShowAllNotifs] = useState(false);
  const [dismissedNotifications, setDismissedNotifications] = useState([]);

  useEffect(() => {
    if (!admin) {
      navigate('/admin/login');
    } else {
      fetchStats();
    }
  }, [admin]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const { data } = await getAdminStats();
      setStats({
        totalUsers: data.totalUsers || 0,
        usersToday: data.usersToday || 0,
        verifiedUsers: data.verifiedUsers || 0,
        pendingKYC: data.pendingKYC || 0,
        activeSubscriptions: data.activePlans || 0,
        totalVolume: data.totalSavings || 0,
        openTickets: data.openTickets || 0,
        totalDownlines: data.totalDownlines || 0,
        totalReferralCodes: data.totalReferralCodes || 0,
        recentUsers: data.recentUsers || []
      });
      const { data: transfers } = await getRecentTransfers(48);
      setRecentTransfers(transfers.slice(0, 10));
      const { data: maturity } = await getMaturitySummary();
      setMaturitySummary(maturity);
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const { data } = await getAdminNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching admin notifications:', err);
    }
  };

  useEffect(() => {
    if (!admin) {
      navigate('/admin/login');
    } else {
      fetchStats();
      fetchNotifications();
    }
  }, [admin]);

  const handleMarkRead = async (notifId) => {
    try {
      await markAdminNotificationRead(notifId);
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAdminNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Error marking all notifications read:', err);
    }
  };

  const handleDismissNotification = (notifId) => {
    setDismissedNotifications(prev => [...prev, notifId]);
  };

  const handleRunMaturity = async () => {
    if (!window.confirm('Run the maturity check now? A plan that completes its 84-day cycle and reaches day 90 will enter eligibility review.')) return;
    try {
      setMaturityRunning(true);
      const { data } = await runMaturityCheck();
      const matured = data.summary?.matured || 0;
      alert(`${matured} plan${matured === 1 ? '' : 's'} moved to eligibility review.`);
      await fetchStats();
    } catch (error) {
      alert(error.response?.data?.message || 'Unable to run maturity check.');
    } finally {
      setMaturityRunning(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <div className="header-title">
          <div className="header-icon"><FaChartPie /></div>
          <div>
            <h2>Administrator Command Center</h2>
            <p className="text-muted">Overview of Palm Merit Global platform performance and operations.</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="notification-trigger" aria-label="View notifications" title="View notifications" onClick={() => setShowAllNotifs(!showAllNotifs)}>
            <FaBell />
            <span className={`notification-count ${notifications.filter(n => !n.is_read).length === 0 ? 'is-zero' : ''}`}>
              {notifications.filter(n => !n.is_read).length}
            </span>
          </button>
          <button className="btn btn-primary" type="button" onClick={handleRunMaturity} disabled={maturityRunning}>
            <FaSyncAlt className={maturityRunning ? 'fa-spin' : ''} /> {maturityRunning ? 'Checking...' : 'Run Maturity Check'}
          </button>
        </div>
      </header>

      {showAllNotifs && createPortal((
        <div className="admin-dashboard notification-portal">
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
                const icon = notif.type === 'admin_approval' ? '🔔' : notif.type === 'clearance' ? '🔓' : notif.type === 'payout' ? '💰' : '📢';
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
            {notifications.length > 5 && <button type="button" className="notification-popover-footer" onClick={() => { setShowAllNotifs(false); }}>Manage all notifications</button>}
          </section>
          </div>
        </div>
      ), document.body)}

      <div className="stats-grid stats-grid-financial">
        <div className="stat-card" onClick={() => navigate('/admin/members')}>
          <div className="stat-icon-wrapper"><FaUsers /></div>
          <div className="stat-info">
            <h3>Total Community</h3>
            <div className="stat-value">{stats.totalUsers}</div>
            <p className="stat-label">
              <span className="text-success" style={{ fontWeight: 'bold' }}>+{stats.usersToday}</span> Registered Today
            </p>
          </div>
        </div>

        <div className="stat-card warning" onClick={() => navigate('/admin/kyc-queue')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon-wrapper"><FaUserCheck /></div>
          <div className="stat-info">
            <h3>Identity Verification</h3>
            <div className="stat-value">{stats.pendingKYC}</div>
            <p className="stat-label text-warning">
              {stats.verifiedUsers} Verified Members
            </p>
          </div>
        </div>

        <div className="stat-card" onClick={() => navigate('/admin/referrals')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon-wrapper" style={{ background: 'rgba(212, 175, 55, 0.1)' }}><FaUserFriends style={{ color: '#d4af37' }} /></div>
          <div className="stat-info">
            <h3>Referral Network</h3>
            <div className="stat-value">{stats.totalDownlines}</div>
            <p className="stat-label">
              <span style={{ fontWeight: 'bold', color: '#d4af37' }}>{stats.totalReferralCodes}</span> Active Referral Codes
            </p>
          </div>
        </div>

        <div className="stat-card danger" onClick={() => navigate('/admin/tickets')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon-wrapper"><FaExclamationTriangle /></div>
          <div className="stat-info">
            <h3>Support Tickets</h3>
            <div className="stat-value">{stats.openTickets}</div>
            <p className="stat-label text-danger">Open Issues</p>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon-wrapper"><FaMoneyBillWave /></div>
          <div className="stat-info">
            <h3>AUM</h3>
            <div className="stat-value">{formatCurrency(stats.totalVolume)}</div>
            <p className="stat-label text-success">Total Community Savings</p>
          </div>
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: 24, padding: 22, borderLeft: '4px solid #d4af37' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(212, 175, 55, 0.12)', color: '#800020' }}><FaClipboardCheck /></div>
            <div><h3 style={{ margin: 0 }}>Maturity & Clearance Pipeline</h3><p className="text-muted" style={{ margin: '5px 0 0' }}>84-day savings completion • 90-day eligibility review • clearance follows after review.</p></div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-outline" type="button" onClick={() => navigate('/admin/eligibility-queue')}>Eligibility Review ({maturitySummary.eligibility_review || 0})</button>
            <button className="btn btn-accent" type="button" onClick={() => navigate('/admin/clearance')}>Clearance ({maturitySummary.pending_clearance || 0})</button>
          </div>
        </div>
      </div>

      <div className="admin-grid-single" style={{ marginTop: '30px' }}>
        <div className="dashboard-section" style={{ marginTop: 0 }}>
          <div className="section-header">
            <h3>Quick Management Actions</h3>
          </div>
          <div className="admin-actions-grid">
            <div className="admin-action-card" onClick={() => navigate('/admin/kyc-queue')}>
              <div className="action-icon"><FaUserCheck /></div>
              <div className="action-content">
                <h4>KYC Queue</h4>
                <p>Process identities.</p>
              </div>
            </div>

            <div className="admin-action-card" onClick={() => navigate('/admin/payouts')}>
              <div className="action-icon"><FaMoneyBillWave /></div>
              <div className="action-content">
                <h4>Maturity</h4>
                <p>Settlements.</p>
              </div>
            </div>

            <div className="admin-action-card" onClick={() => navigate('/admin/plans')}>
              <div className="action-icon"><FaPiggyBank /></div>
              <div className="action-content">
                <h4>Rates</h4>
                <p>Configure plans.</p>
              </div>
            </div>

            <div className="admin-action-card" onClick={() => navigate('/admin/reconciliation')}>
              <div className="action-icon"><FaChartPie /></div>
              <div className="action-content">
                <h4>Analytics</h4>
                <p>Financial reports.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-section" style={{ marginTop: 0 }}>
          <div className="section-header">
            <h3>Recent Registrations</h3>
          </div>
          <div className="admin-card recent-activity-card">
            <div className="recent-list">
              {stats.recentUsers.length === 0 ? (
                <p className="text-muted p-3">No recent registrations.</p>
              ) : (
                stats.recentUsers.map((rUser, idx) => (
                  <div key={idx} className="recent-item" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderBottom: idx === stats.recentUsers.length - 1 ? 'none' : '1px solid rgba(0,0,0,0.05)' }}>
                    <div className="recent-avatar" style={{ width: '35px', height: '35px', borderRadius: '50%', background: '#800020', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      {rUser.first_name?.[0]}{rUser.last_name?.[0]}
                    </div>
                    <div className="recent-info">
                      <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{rUser.first_name} {rUser.last_name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(rUser.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button className="btn-text-only" onClick={() => navigate('/admin/members')} style={{ width: '100%', padding: '10px', borderTop: '1px solid rgba(0,0,0,0.05)', color: '#800020', fontWeight: 'bold', background: 'none', border: 'none', cursor: 'pointer' }}>
              View All Members
            </button>
          </div>
        </div>

        <div className="dashboard-section" style={{ marginTop: 0 }}>
          <div className="section-header">
            <h3>Recent Payments</h3>
          </div>
          <div className="admin-card recent-activity-card">
            <div className="recent-list">
              {recentTransfers.length === 0 ? (
                <p className="text-muted p-3">No recent payments.</p>
              ) : (
                recentTransfers.map((tx, idx) => (
                  <div key={tx.id} className="recent-item" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderBottom: idx === recentTransfers.length - 1 ? 'none' : '1px solid rgba(0,0,0,0.05)' }}>
                    <div className="recent-avatar" style={{ width: '35px', height: '35px', borderRadius: '50%', background: tx.type === 'clearance' ? '#f59e0b' : tx.type === 'membership' ? '#1e293b' : '#800020', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      <FaCreditCard />
                    </div>
                    <div className="recent-info" style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{tx.first_name} {tx.last_name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: 8 }}>
                        <span style={{ textTransform: 'capitalize' }}>{tx.type.replace('_', ' ')}</span>
                        <span>•</span>
                        <span>{new Date(tx.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div style={{ fontWeight: '700', color: '#15803d', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                      {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(tx.amount)}
                    </div>
                  </div>
                ))
              )}
            </div>
            <button className="btn-text-only" onClick={() => navigate('/admin/reconciliation')} style={{ width: '100%', padding: '10px', borderTop: '1px solid rgba(0,0,0,0.05)', color: '#800020', fontWeight: 'bold', background: 'none', border: 'none', cursor: 'pointer' }}>
              View All Transactions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
