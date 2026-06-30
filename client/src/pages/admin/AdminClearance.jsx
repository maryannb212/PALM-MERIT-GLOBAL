import React, { useState, useEffect, useCallback } from 'react';
import { getAdminClearance, adminSettleClearance } from '../../services/api';
import { FaCheckCircle, FaTimesCircle, FaSpinner, FaSearch, FaFilter } from 'react-icons/fa';
import '../dashboard/Dashboard.css';

const AdminClearance = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [settling, setSettling] = useState(null);

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getAdminClearance(statusFilter || undefined);
      setPlans(response.data || []);
    } catch (error) {
      console.error('Failed to fetch clearance plans:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  const handleSettle = async (planId) => {
    if (!window.confirm('Mark this plan as settled? This will finalize the payout.')) return;
    setSettling(planId);
    try {
      await adminSettleClearance(planId);
      alert('Plan settled successfully.');
      fetchPlans();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to settle plan.');
    } finally {
      setSettling(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending_clearance': return <span className="badge" style={{ background: '#f59e0b', color: '#fff' }}>Pending Clearance</span>;
      case 'pending_settlement': return <span className="badge" style={{ background: '#3b82f6', color: '#fff' }}>Pending Settlement</span>;
      case 'settled': return <span className="badge" style={{ background: '#10b981', color: '#fff' }}>Settled</span>;
      default: return <span className="badge badge-secondary">{status}</span>;
    }
  };

  const pendingSettlement = plans.filter(p => p.status === 'pending_settlement');
  const pendingClearance = plans.filter(p => p.status === 'pending_clearance');
  const settledCount = plans.filter(p => p.status === 'settled').length;

  return (
    <>
      <header className="dashboard-header">
        <h2>Clearance Management</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <FaFilter />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}>
            <option value="">All Clearance Statuses</option>
            <option value="pending_clearance">Pending Clearance</option>
            <option value="pending_settlement">Pending Settlement</option>
            <option value="settled">Settled</option>
          </select>
        </div>
      </header>

      <div className="defaults-stats-grid" style={{ marginBottom: 24 }}>
        <div className="defaults-stat-card" style={{ '--accent': '#f59e0b', '--accent-bg': '#fffbeb' }}>
          <div className="defaults-stat-icon" style={{ background: '#fffbeb', color: '#f59e0b' }}><FaSearch /></div>
          <div className="defaults-stat-info">
            <span className="defaults-stat-label">Pending Clearance</span>
            <span className="defaults-stat-value">{pendingClearance.length}</span>
          </div>
        </div>
        <div className="defaults-stat-card" style={{ '--accent': '#3b82f6', '--accent-bg': '#eff6ff' }}>
          <div className="defaults-stat-icon" style={{ background: '#eff6ff', color: '#3b82f6' }}><FaSpinner /></div>
          <div className="defaults-stat-info">
            <span className="defaults-stat-label">Pending Settlement</span>
            <span className="defaults-stat-value">{pendingSettlement.length}</span>
          </div>
        </div>
        <div className="defaults-stat-card" style={{ '--accent': '#10b981', '--accent-bg': '#f0fdf4' }}>
          <div className="defaults-stat-icon" style={{ background: '#f0fdf4', color: '#10b981' }}><FaCheckCircle /></div>
          <div className="defaults-stat-info">
            <span className="defaults-stat-label">Settled</span>
            <span className="defaults-stat-value">{settledCount}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="defaults-loading">Loading clearance plans...</div>
      ) : plans.length === 0 ? (
        <div className="defaults-empty">
          <FaCheckCircle className="defaults-empty-icon" />
          <h4>No Clearance Plans Found</h4>
          <p>No programs are currently in the clearance pipeline.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px' }}>User</th>
                <th style={{ padding: '10px 12px' }}>Plan</th>
                <th style={{ padding: '10px 12px' }}>Accounts</th>
                <th style={{ padding: '10px 12px' }}>Cleared</th>
                <th style={{ padding: '10px 12px' }}>Fee Due</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
                <th style={{ padding: '10px 12px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map(plan => {
                const accounts = plan.number_of_accounts || 1;
                const ac = parseInt(plan.accounts_cleared || 0, 10);
                const remaining = accounts - ac;
                const feeDue = remaining * 3000;

                return (
                  <tr key={plan.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <strong>{plan.first_name} {plan.last_name}</strong>
                      <br /><span style={{ fontSize: '0.75rem', color: '#64748b' }}>{plan.email}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>{plan.plan_name}</td>
                    <td style={{ padding: '10px 12px' }}>{accounts}</td>
                    <td style={{ padding: '10px 12px' }}>{ac} / {accounts}</td>
                    <td style={{ padding: '10px 12px' }}>{formatCurrency(feeDue)}</td>
                    <td style={{ padding: '10px 12px' }}>{getStatusBadge(plan.status)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {plan.status === 'pending_settlement' && (
                        <button className="btn btn-sm"
                          onClick={() => handleSettle(plan.id)}
                          disabled={settling === plan.id}
                          style={{
                            background: settling === plan.id ? '#94a3b8' : '#10b981',
                            color: '#fff', border: 'none', padding: '6px 14px',
                            borderRadius: 4, fontWeight: 600, cursor: settling === plan.id ? 'not-allowed' : 'pointer'
                          }}>
                          {settling === plan.id ? 'Settling...' : 'Settle'}
                        </button>
                      )}
                      {plan.status === 'settled' && (
                        <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.8rem' }}>
                          <FaCheckCircle /> Done
                        </span>
                      )}
                      {plan.status === 'pending_clearance' && (
                        <span style={{ color: '#f59e0b', fontSize: '0.8rem' }}>Awaiting user payment</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

export default AdminClearance;
