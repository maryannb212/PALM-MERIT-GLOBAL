import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getDailyAccountStats } from '../../services/api';
import { FaCalendarDay, FaUsers, FaUserCheck, FaPiggyBank, FaFilter } from 'react-icons/fa';
import '../dashboard/Dashboard.css';
import './Admin.css';

const AdminDailyAccounts = () => {
  const { admin } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState({ dailyStats: [], summary: {}, today: {} });
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (!admin) {
      navigate('/admin/login');
    } else {
      fetchStats();
    }
  }, [admin, days]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const { data } = await getDailyAccountStats(days);
      setData(data);
    } catch (error) {
      console.error('Error fetching daily account stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  const isToday = (dateStr) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  };

  // Group daily stats by date
  const groupedByDate = data.dailyStats.reduce((acc, row) => {
    if (!acc[row.date]) acc[row.date] = [];
    acc[row.date].push(row);
    return acc;
  }, {});

  const dateKeys = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <div className="header-title">
          <div className="header-icon"><FaCalendarDay /></div>
          <div>
            <h2>Daily Account Creation</h2>
            <p className="text-muted">Track savings plan subscriptions created per day across the platform.</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FaFilter style={{ color: 'var(--color-primary)' }} />
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--color-primary)',
              background: '#fff',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#333',
              cursor: 'pointer'
            }}
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </header>

      {/* Today's Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-icon-wrapper"><FaPiggyBank /></div>
          <div className="stat-info">
            <h3>Plans Today</h3>
            <p className="stat-value">{data.today.plans_today || 0}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper"><FaCalendarDay /></div>
          <div className="stat-info">
            <h3>Accounts Today</h3>
            <p className="stat-value">{data.today.accounts_today || 0}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper"><FaUserCheck /></div>
          <div className="stat-info">
            <h3>Users Today</h3>
            <p className="stat-value">{data.today.users_today || 0}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper"><FaUsers /></div>
          <div className="stat-info">
            <h3>Total ({days}d)</h3>
            <p className="stat-value">{data.summary.total_plans || 0}</p>
          </div>
        </div>
      </div>

      {/* Period Summary */}
      <div style={{
        background: 'linear-gradient(135deg, #fff8e1 0%, #fffde7 100%)',
        border: '1px solid var(--color-primary)',
        borderRadius: '12px',
        padding: '16px 24px',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-around',
        textAlign: 'center'
      }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>Total Plans</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-primary-dark)' }}>{data.summary.total_plans || 0}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>Total Accounts</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-primary-dark)' }}>{data.summary.total_accounts || 0}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>Unique Users</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-primary-dark)' }}>{data.summary.unique_users || 0}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>Initial Savings</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-primary-dark)' }}>
            {(data.summary.total_initial_savings || 0).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}
          </div>
        </div>
      </div>

      {/* Daily Breakdown Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888' }}>Loading...</div>
      ) : dateKeys.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888' }}>No account creation data for this period.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {dateKeys.map((date) => {
            const rows = groupedByDate[date];
            const dayTotal = rows.reduce((sum, r) => sum + parseInt(r.total_accounts || 0), 0);
            const dayUsers = rows.reduce((sum, r) => sum + parseInt(r.unique_users || 0), 0);
            return (
              <div key={date} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{
                  padding: '14px 20px',
                  background: isToday(date) ? 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))' : '#fff8e1',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontWeight: 700, color: isToday(date) ? '#fff' : '#333', fontSize: '0.95rem' }}>
                    {isToday(date) ? 'Today — ' : ''}{formatDate(date)}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: isToday(date) ? '#fff' : '#666' }}>
                    {dayTotal} account{dayTotal !== 1 ? 's' : ''} · {dayUsers} user{dayUsers !== 1 ? 's' : ''}
                  </span>
                </div>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Plan Name</th>
                      <th>Plans Created</th>
                      <th>Total Accounts</th>
                      <th>Unique Users</th>
                      <th>Initial Savings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{row.plan_name}</td>
                        <td>{row.total_accounts}</td>
                        <td>{row.total_account_count}</td>
                        <td>{row.unique_users}</td>
                        <td>{Number(row.total_initial_savings).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminDailyAccounts;
