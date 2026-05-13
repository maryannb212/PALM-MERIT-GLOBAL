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
    pendingKYC: 0,
    activeSubscriptions: 0,
    totalVolume: 0,
    openTickets: 0
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
        pendingKYC: data.pendingKYC || 0,
        activeSubscriptions: data.activePlans || 0,
        totalVolume: data.totalSavings || 0,
        openTickets: data.openTickets || 0
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
            <p className="stat-label">Registered Members</p>
          </div>
        </div>

        <div className="stat-card warning" onClick={() => navigate('/admin/kyc-queue')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon-wrapper"><FaUserCheck /></div>
          <div className="stat-info">
            <h3>Pending KYC</h3>
            <div className="stat-value">{stats.pendingKYC}</div>
            <p className="stat-label text-warning">Awaiting Verification</p>
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

      <div className="dashboard-section">
        <div className="section-header">
          <h3>Quick Management Actions</h3>
        </div>
        <div className="admin-actions-grid">
          <div className="admin-action-card" onClick={() => navigate('/admin/kyc-queue')}>
            <div className="action-icon"><FaUserCheck /></div>
            <div className="action-content">
              <h4>KYC Verification Queue</h4>
              <p>Review and process pending identity documents.</p>
            </div>
            <FaArrowRight className="arrow-icon" />
          </div>

          <div className="admin-action-card" onClick={() => navigate('/admin/payouts')}>
            <div className="action-icon"><FaMoneyBillWave /></div>
            <div className="action-content">
              <h4>Maturity & Payouts</h4>
              <p>Manage program settlements and withdrawals.</p>
            </div>
            <FaArrowRight className="arrow-icon" />
          </div>

          <div className="admin-action-card" onClick={() => navigate('/admin/plans')}>
            <div className="action-icon"><FaPiggyBank /></div>
            <div className="action-content">
              <h4>Manage Savings Plans</h4>
              <p>Configure program interest rates and maturity rules.</p>
            </div>
            <FaArrowRight className="arrow-icon" />
          </div>

          <div className="admin-action-card" onClick={() => navigate('/admin/reconciliation')}>
            <div className="action-icon"><FaChartPie /></div>
            <div className="action-content">
              <h4>Platform Analytics</h4>
              <p>View growth trends and financial performance reports.</p>
            </div>
            <FaArrowRight className="arrow-icon" />
          </div>

          <div className="admin-action-card" onClick={() => navigate('/admin/broadcast')}>
            <div className="action-icon"><FaBullhorn /></div>
            <div className="action-content">
              <h4>System Broadcast</h4>
              <p>Send notifications to all community members.</p>
            </div>
            <FaArrowRight className="arrow-icon" />
          </div>

          <div className="admin-action-card" onClick={() => navigate('/admin/defaulters')}>
            <div className="action-icon"><FaGavel /></div>
            <div className="action-content">
              <h4>Defaulter Management</h4>
              <p>Monitor and resolve payment default cases.</p>
            </div>
            <FaArrowRight className="arrow-icon" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
