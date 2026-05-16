import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getAdminStats } from '../../services/api';
import { FaUsers, FaUserCheck, FaExclamationTriangle, FaMoneyBillWave, FaArrowRight, FaChartPie, FaGavel, FaBullhorn, FaPiggyBank } from 'react-icons/fa';
import '../dashboard/Dashboard.css';
import './Admin.css';

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    usersToday: 0,
    verifiedUsers: 0,
    pendingKYC: 0,
    activeSubscriptions: 0,
    totalVolume: 0,
    openTickets: 0,
    recentUsers: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/dashboard');
    } else {
      fetchStats();
    }
  }, [user]);

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
        recentUsers: data.recentUsers || []
      });
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    } finally {
      setLoading(false);
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
      </header>

      <div className="stats-grid">
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

      <div className="dashboard-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '25px', marginTop: '30px' }}>
        <div className="dashboard-section" style={{ marginTop: 0 }}>
          <div className="section-header">
            <h3>Quick Management Actions</h3>
          </div>
          <div className="admin-actions-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
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
      </div>
    </div>
  );
};

export default AdminDashboard;
