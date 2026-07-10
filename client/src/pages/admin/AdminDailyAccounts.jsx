import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getDailyAccountStats } from '../../services/api';
import { FaCalendarDay, FaUsers, FaPiggyBank, FaFilter } from 'react-icons/fa';
import '../dashboard/Dashboard.css';
import './Admin.css';

const FILTERS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
];

const AdminDailyAccounts = () => {
  const { admin } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState({ accounts: [], total: 0, totalAccounts: 0 });
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  useEffect(() => {
    if (!admin) {
      navigate('/admin/login');
    } else {
      fetchStats();
    }
  }, [admin, activeFilter, customFrom, customTo]);

  const fetchStats = async () => {
    if (activeFilter === 'custom' && (!customFrom || !customTo)) return;
    try {
      setLoading(true);
      const { data } = await getDailyAccountStats(activeFilter, customFrom, customTo);
      setData(data);
    } catch (error) {
      console.error('Error fetching daily account stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount || 0);
  };

  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    const str = String(dateStr);
    if (str.includes('T')) return new Date(str);
    return new Date(str.replace(' ', 'T') + 'Z');
  };

  const formatDate = (dateStr) => {
    const d = parseDate(dateStr);
    if (!d || isNaN(d)) return '—';
    return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatTime = (dateStr) => {
    const d = parseDate(dateStr);
    if (!d || isNaN(d)) return '';
    return d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  };

  const groupedByUser = useMemo(() => {
    const groups = {};
    for (const a of data.accounts) {
      const key = a.user_id || a.email;
      if (!groups[key]) {
        groups[key] = {
          user_id: a.user_id,
          name: `${a.first_name} ${a.last_name}`,
          email: a.email,
          accounts: []
        };
      }
      groups[key].accounts.push(a);
    }
    return Object.values(groups);
  }, [data.accounts]);

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <div className="header-title">
          <div className="header-icon"><FaCalendarDay /></div>
          <div>
            <h2>Account Creations</h2>
            <p className="text-muted">See who created savings plans and when.</p>
          </div>
        </div>
      </header>

      {/* Filter Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <FaFilter style={{ color: 'var(--color-primary)' }} />
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: activeFilter === f.key ? '2px solid var(--color-primary)' : '1px solid #e2e8f0',
              background: activeFilter === f.key ? 'var(--color-primary)' : '#fff',
              color: activeFilter === f.key ? '#fff' : '#333',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {f.label}
          </button>
        ))}
        {activeFilter === 'custom' && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}
            />
            <span style={{ color: '#666' }}>to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}
            />
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="stats-grid stats-grid-financial" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-icon-wrapper"><FaPiggyBank /></div>
          <div className="stat-info">
            <h3>Plans Created</h3>
            <p className="stat-value">{data.total || 0}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper"><FaCalendarDay /></div>
          <div className="stat-info">
            <h3>Total Accounts</h3>
            <p className="stat-value">{data.totalAccounts || 0}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper"><FaUsers /></div>
          <div className="stat-info">
            <h3>Users</h3>
            <p className="stat-value">{groupedByUser.length}</p>
          </div>
        </div>
      </div>

      {/* Grouped by User */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888' }}>Loading...</div>
      ) : groupedByUser.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888' }}>No accounts created for this period.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {groupedByUser.map((user) => (
            <div key={user.user_id} style={{
              background: '#fff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden'
            }}>
              {/* User Header */}
              <div style={{
                padding: '14px 20px',
                background: 'linear-gradient(135deg, #fff8e1 0%, #fffde7 100%)',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#333', fontSize: '0.95rem' }}>{user.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#888' }}>{user.email}</div>
                </div>
                <div style={{
                  background: 'var(--color-primary)',
                  color: '#fff',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  fontWeight: 700
                }}>
                  {user.accounts.length} plan{user.accounts.length > 1 ? 's' : ''} · {user.accounts.reduce((s, a) => s + (a.number_of_accounts || 1), 0)} account{user.accounts.reduce((s, a) => s + (a.number_of_accounts || 1), 0) > 1 ? 's' : ''}
                </div>
              </div>

              {/* User's Accounts Table */}
              <table className="admin-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Accounts</th>
                    <th>Initial Savings</th>
                    <th>Status</th>
                    <th>Date Created</th>
                  </tr>
                </thead>
                <tbody>
                  {user.accounts.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{a.plan_name?.replace('_', ' ').toLowerCase()}</td>
                      <td>{a.number_of_accounts || 1}</td>
                      <td>{formatCurrency(a.current_amount)}</td>
                      <td>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: a.status === 'active' ? '#f0fdf4' : '#fef2f2',
                          color: a.status === 'active' ? '#16a34a' : '#dc2626'
                        }}>
                          {a.status || 'active'}
                        </span>
                      </td>
                      <td>
                        <div>{formatDate(a.created_at)}</div>
                        <div style={{ fontSize: '0.75rem', color: '#888' }}>{formatTime(a.created_at)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminDailyAccounts;
