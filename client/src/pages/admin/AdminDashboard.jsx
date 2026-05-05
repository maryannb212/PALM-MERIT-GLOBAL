import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

import { getAdminStats } from '../../services/api';
import { FaUsers, FaUserCheck, FaExclamationTriangle, FaMoneyBillWave } from 'react-icons/fa';
import '../dashboard/Dashboard.css';
import './Admin.css';

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    pendingKYC: 0,
    activeSubscriptions: 0,
    totalVolume: 0
  });

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/dashboard');
    } else {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      const { data } = await getAdminStats();
      setStats({
        totalUsers: data.totalUsers || 0,
        pendingKYC: stats.pendingKYC, // KYC pending is currently fetched differently, we can mock or query
        activeSubscriptions: data.activePlans || 0,
        totalVolume: data.totalSavings || 0,
        openTickets: data.openTickets || 0
      });
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  return (
    <>
        <header className="dashboard-header">
          <div>
            <h2>Administrator Command Center</h2>
            <p className="text-muted">Welcome back, Super Admin. Here is the platform overview.</p>
          </div>
        </header>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon-wrapper"><FaUsers /></div>
            <div className="stat-info">
              <h3>Total Users</h3>
              <div className="stat-value">{stats.totalUsers}</div>
            </div>
          </div>
          <div className="stat-card warning" onClick={() => navigate('/admin/kyc-queue')} style={{ cursor: 'pointer' }}>
            <div className="stat-icon-wrapper"><FaUserCheck /></div>
            <div className="stat-info">
              <h3>Pending KYC</h3>
              <div className="stat-value">{stats.pendingKYC}</div>
              <small className="text-warning">Requires Attention</small>
            </div>
          </div>
          <div className="stat-card" onClick={() => navigate('/admin/tickets')} style={{ cursor: 'pointer' }}>
            <div className="stat-icon-wrapper"><FaExclamationTriangle /></div>
            <div className="stat-info">
              <h3>Support Tickets</h3>
              <div className="stat-value">{stats.openTickets || 0}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper"><FaMoneyBillWave /></div>
            <div className="stat-info">
              <h3>Total Savings</h3>
              <div className="stat-value">{formatCurrency(stats.totalVolume)}</div>
            </div>
          </div>
        </div>

        <div className="dashboard-section">
          <h3>Quick Links</h3>
          <div className="admin-actions-grid">
            <button className="admin-action-card" onClick={() => navigate('/admin/kyc-queue')}>
              <h4>Review KYC Submissions</h4>
              <p>Verify user identities and documents.</p>
            </button>
            <button className="admin-action-card">
              <h4>Manage Savings Plans</h4>
              <p>Edit interest rates and program details.</p>
            </button>
            <button className="admin-action-card">
              <h4>Platform Analytics</h4>
              <p>View growth and transaction reports.</p>
            </button>
          </div>
        </div>
    </>
  );
};

export default AdminDashboard;
