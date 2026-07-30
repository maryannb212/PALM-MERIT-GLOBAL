import React, { useState, useEffect, useCallback } from 'react';
import { getAdminClearance, adminSettleClearance } from '../../services/api';
import { FaCheckCircle, FaSpinner, FaFilter, FaChevronDown, FaChevronUp, FaUser, FaCreditCard, FaWallet, FaMoneyBillWave } from 'react-icons/fa';
import '../dashboard/Dashboard.css';

const AdminClearance = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [settling, setSettling] = useState(null);
  const [expandedPlan, setExpandedPlan] = useState(null);

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
    if (!window.confirm('Mark this plan as paid? This will finalize the payout.')) return;
    setSettling(planId);
    try {
      await adminSettleClearance(planId);
      alert('Plan marked as paid successfully.');
      fetchPlans();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to approve plan.');
    } finally {
      setSettling(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending_clearance': return <span className="badge" style={{ background: '#f59e0b', color: '#fff' }}>Pending Clearance</span>;
      case 'pending_settlement': return <span className="badge" style={{ background: '#3b82f6', color: '#fff' }}>Pending Approval</span>;
      case 'settled': return <span className="badge" style={{ background: '#10b981', color: '#fff' }}>Settled</span>;
      default: return <span className="badge badge-secondary">{status}</span>;
    }
  };

  const pendingApproval = plans.filter(p => p.status === 'pending_settlement');
  const pendingClearance = plans.filter(p => p.status === 'pending_clearance');
  const paidCount = plans.filter(p => p.status === 'settled').length;

  const toggleExpand = (planId) => {
    setExpandedPlan(expandedPlan === planId ? null : planId);
  };

  return (
    <>
      <header className="dashboard-header">
        <h2>Clearance Management</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <FaFilter />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}>
            <option value="">All Statuses</option>
            <option value="pending_clearance">Pending Clearance</option>
            <option value="pending_settlement">Pending Approval</option>
            <option value="settled">Settled</option>
          </select>
        </div>
      </header>

      <div className="defaults-stats-grid" style={{ marginBottom: 24 }}>
        <div className="defaults-stat-card" style={{ '--accent': '#f59e0b', '--accent-bg': '#fffbeb' }}>
          <div className="defaults-stat-icon" style={{ background: '#fffbeb', color: '#f59e0b' }}><FaSpinner /></div>
          <div className="defaults-stat-info">
            <span className="defaults-stat-label">Pending Clearance</span>
            <span className="defaults-stat-value">{pendingClearance.length}</span>
          </div>
        </div>
        <div className="defaults-stat-card" style={{ '--accent': '#3b82f6', '--accent-bg': '#eff6ff' }}>
          <div className="defaults-stat-icon" style={{ background: '#eff6ff', color: '#3b82f6' }}><FaWallet /></div>
          <div className="defaults-stat-info">
            <span className="defaults-stat-label">Pending Approval</span>
            <span className="defaults-stat-value">{pendingApproval.length}</span>
          </div>
        </div>
        <div className="defaults-stat-card" style={{ '--accent': '#10b981', '--accent-bg': '#f0fdf4' }}>
          <div className="defaults-stat-icon" style={{ background: '#f0fdf4', color: '#10b981' }}><FaCheckCircle /></div>
          <div className="defaults-stat-info">
            <span className="defaults-stat-label">Paid</span>
            <span className="defaults-stat-value">{paidCount}</span>
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
        <div className="defaults-plans-list">
          {plans.map(plan => {
            const accounts = plan.number_of_accounts || 1;
            const ac = parseInt(plan.accounts_cleared || 0, 10);
            const remaining = accounts - ac;
            const feeDue = remaining * 3000;
            const isExpanded = expandedPlan === plan.id;
            const userFullName = `${plan.first_name || ''} ${plan.last_name || ''}`.trim() || plan.email;

            return (
              <div key={plan.id} className={`defaults-plan-card ${plan.status === 'pending_clearance' ? 'has-default' : ''}`}
                style={{ '--plan-accent': plan.status === 'settled' ? '#10b981' : plan.status === 'pending_settlement' ? '#3b82f6' : '#f59e0b', '--plan-border': plan.status === 'settled' ? '#10b981' : plan.status === 'pending_settlement' ? '#3b82f6' : '#f59e0b' }}>
                <div className="defaults-plan-header" onClick={() => toggleExpand(plan.id)} style={{ cursor: 'pointer' }}>
                  <div className="defaults-plan-left">
                    <div className="defaults-plan-icon" style={{ background: plan.status === 'settled' ? '#f0fdf4' : plan.status === 'pending_settlement' ? '#eff6ff' : '#fffbeb' }}>
                      <FaUser style={{ color: plan.status === 'settled' ? '#16a34a' : plan.status === 'pending_settlement' ? '#3b82f6' : '#f59e0b' }} />
                    </div>
                    <div>
                      <h4 className="defaults-plan-name">{userFullName}</h4>
                      <span className="defaults-plan-meta">
                        {plan.plan_name} &middot; {accounts} account{accounts > 1 ? 's' : ''} &middot; {plan.email}
                      </span>
                    </div>
                  </div>
                  <div className="defaults-plan-right">
                    {getStatusBadge(plan.status)}
                    {isExpanded ? <FaChevronUp style={{ marginLeft: 8, color: '#94a3b8' }} /> : <FaChevronDown style={{ marginLeft: 8, color: '#94a3b8' }} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="defaults-plan-details">
                    <div className="defaults-plan-stats">
                      <div className="defaults-plan-stat">
                        <span className="dps-label">Total Accounts</span>
                        <span className="dps-value">{accounts}</span>
                      </div>
                      <div className="defaults-plan-stat">
                        <span className="dps-label">Accounts Cleared</span>
                        <span className="dps-value">{ac} / {accounts}</span>
                      </div>
                      <div className="defaults-plan-stat highlight-danger">
                        <span className="dps-label">Fee Due</span>
                        <span className="dps-value">{formatCurrency(feeDue)}</span>
                      </div>
                    </div>

                    {remaining > 0 && (
                      <div style={{ marginBottom: 12, fontSize: '0.85rem', color: '#64748b' }}>
                        <strong style={{ color: '#334155' }}>Accounts Due for Payment:</strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                          {Array.from({ length: remaining }, (_, i) => {
                            const idx = ac + i;
                            return (
                              <span key={idx} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '4px 10px', background: '#fef2f2', border: '1px solid #fecaca',
                                borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, color: '#dc2626'
                              }}>
                                <FaMoneyBillWave /> Account {idx + 1} &mdash; {formatCurrency(3000)}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      {plan.status === 'pending_settlement' && (
                        <button className="clearance-payall-btn"
                          onClick={() => handleSettle(plan.id)}
                          disabled={settling === plan.id}
                          style={{
                            background: settling === plan.id ? '#94a3b8' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            boxShadow: settling === plan.id ? 'none' : '0 2px 8px rgba(16, 185, 129, 0.2)'
                          }}>
                          {settling === plan.id ? <><FaSpinner className="fa-spin" /> Processing...</> : <><FaCreditCard /> Mark as Paid</>}
                        </button>
                      )}
                      {plan.status === 'settled' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#16a34a', fontWeight: 600, fontSize: '0.88rem' }}>
                          <FaCheckCircle /> Paid
                        </span>
                      )}
                      {plan.status === 'pending_clearance' && (
                        <span style={{ color: '#f59e0b', fontSize: '0.85rem', fontWeight: 600 }}>
                          Awaiting user payment
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

export default AdminClearance;
