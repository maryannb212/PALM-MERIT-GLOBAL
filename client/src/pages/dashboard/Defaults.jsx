import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyDefaults, payWithLotus } from '../../services/api';
import { FaExclamationTriangle, FaWallet, FaShieldAlt, FaTimesCircle, FaCheckCircle, FaInfoCircle, FaArrowRight, FaClipboardList, FaMoneyBillWave, FaUniversity } from 'react-icons/fa';
import './Dashboard.css';
import '../../components/DepositModal.css';

const PLAN_ICONS = {
  CREST: '👑',
  SILVER: '🥈',
  GOLDEN_BASKET: '🧺',
  ISUSU: '🔄'
};

const PLAN_COLORS = {
  CREST: { bg: '#fef2f2', border: '#dc2626', text: '#991b1b', accent: '#ef4444' },
  SILVER: { bg: '#f0f9ff', border: '#64748b', text: '#334155', accent: '#94a3b8' },
  GOLDEN_BASKET: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e', accent: '#f59e0b' },
  ISUSU: { bg: '#f0fdf4', border: '#22c55e', text: '#166534', accent: '#22c55e' }
};

const Defaults = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlan, setExpandedPlan] = useState(null);
  const [totalDefaults, setTotalDefaults] = useState(0);
  const [clearLoading, setClearLoading] = useState(false);
  const [clearError, setClearError] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    fetchDefaults();
  }, []);

  const fetchDefaults = async () => {
    try {
      setLoading(true);
      const response = await getMyDefaults();
      const data = response.data || [];
      setPlans(data);
      const total = data.reduce((sum, p) => sum + p.total_default_amount, 0);
      setTotalDefaults(total);
    } catch (error) {
      console.error('Failed to fetch defaults:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  const hasDefaults = (plan) => plan.default_count > 0;
  const anyDefaults = totalDefaults > 0;

  const toggleExpand = (planId) => {
    setExpandedPlan(expandedPlan === planId ? null : planId);
  };

  const isDaily = (plan) => plan.plan_name === 'ISUSU';
  const periodLabel = (plan) => isDaily(plan) ? 'Daily' : 'Weekly';

  // Clear Defaults — charge exactly the total outstanding, redirect to Lotus
  const handleClearDefaults = async () => {
    setClearLoading(true);
    setClearError('');
    try {
      const { data } = await payWithLotus({ amount: Math.floor(totalDefaults), type: 'deposit' });
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        setClearError('Lotus Bank did not return a payment link. Please try again.');
        setClearLoading(false);
      }
    } catch (err) {
      setClearError(err.response?.data?.message || 'Payment failed. Please try again.');
      setClearLoading(false);
    }
  };

  const statsCards = [
    {
      icon: <FaExclamationTriangle />,
      label: 'Total Default Balance',
      value: formatCurrency(totalDefaults),
      color: '#dc2626',
      bg: '#fef2f2'
    },
    {
      icon: <FaClipboardList />,
      label: 'Programs with Defaults',
      value: plans.filter(hasDefaults).length,
      color: '#ea580c',
      bg: '#fff7ed'
    },
    {
      icon: <FaMoneyBillWave />,
      label: 'Active Programs',
      value: plans.filter(p => p.plan_status === 'active').length,
      color: '#16a34a',
      bg: '#f0fdf4'
    },
    {
      icon: <FaShieldAlt />,
      label: 'Total Accounts',
      value: plans.reduce((sum, p) => sum + (p.number_of_accounts || 1), 0),
      color: '#2563eb',
      bg: '#eff6ff'
    }
  ];

  return (
    <>
      <header className="dashboard-header">
        <h2>Defaults &amp; Penalties</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard/wallet')}>
            <FaWallet /> Fund Wallet
          </button>

          {/* Only show Clear Defaults button when the user actually has defaults */}
          {!loading && anyDefaults && (
            <button
              className="btn btn-secondary"
              onClick={() => setShowConfirmModal(true)}
              style={{ background: '#800020', color: '#fff', border: 'none' }}
              disabled={clearLoading}
            >
              <FaUniversity /> {clearLoading ? 'Redirecting...' : 'Clear Defaults'}
            </button>
          )}
        </div>
      </header>

      {/* Stats */}
      <div className="defaults-stats-grid">
        {statsCards.map((card, i) => (
          <div key={i} className="defaults-stat-card" style={{ '--accent': card.color, '--accent-bg': card.bg }}>
            <div className="defaults-stat-icon" style={{ background: card.bg, color: card.color }}>
              {card.icon}
            </div>
            <div className="defaults-stat-info">
              <span className="defaults-stat-label">{card.label}</span>
              <span className="defaults-stat-value">{card.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Plans List */}
      <div className="defaults-section">
        <h3><FaClipboardList /> Program Default Status</h3>

        {loading ? (
          <div className="defaults-loading">Loading your programs...</div>
        ) : plans.length === 0 ? (
          <div className="defaults-empty">
            <FaCheckCircle className="defaults-empty-icon" />
            <h4>No Programs Found</h4>
            <p>You haven't subscribed to any savings programs yet.</p>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard/packages')}>
              Browse Programs
            </button>
          </div>
        ) : (
          <div className="defaults-plans-list">
            {plans.map(plan => {
              const colors = PLAN_COLORS[plan.plan_name] || PLAN_COLORS.CREST;
              const inDefault = hasDefaults(plan);
              const defaultPerAccount = plan.penalty_per_account || 0;
              const isDailyPlan = isDaily(plan);
              const contributionPerAccount = plan.weekly_amount || 0;

              return (
                <div
                  key={plan.plan_id}
                  className={`defaults-plan-card ${inDefault ? 'has-default' : ''}`}
                  style={{ '--plan-accent': colors.accent, '--plan-border': inDefault ? colors.border : '#e2e8f0' }}
                  onClick={() => toggleExpand(plan.plan_id)}
                >
                  <div className="defaults-plan-header">
                    <div className="defaults-plan-left">
                      <span className="defaults-plan-icon">{PLAN_ICONS[plan.plan_name] || '📋'}</span>
                      <div>
                        <h4 className="defaults-plan-name">{plan.plan_name}</h4>
                        <span className="defaults-plan-meta">
                          {plan.number_of_accounts || 1} account{(plan.number_of_accounts || 1) > 1 ? 's' : ''}
                          {plan.plan_status === 'active' ? ' • Active' : ` • ${plan.plan_status}`}
                          {isDailyPlan && ' • Daily'}
                        </span>
                      </div>
                    </div>
                    <div className="defaults-plan-right">
                      {inDefault && (
                        <span className="defaults-badge danger">
                          <FaTimesCircle /> Defaulting
                        </span>
                      )}
                      {!inDefault && (
                        <span className="defaults-badge safe">
                          <FaCheckCircle /> Good Standing
                        </span>
                      )}
                      <span className={`defaults-chevron ${expandedPlan === plan.plan_id ? 'open' : ''}`}>
                        <FaArrowRight />
                      </span>
                    </div>
                  </div>

                  <div className="defaults-plan-stats">
                    <div className="defaults-plan-stat">
                      <span className="dps-label">{periodLabel(plan)} per Account</span>
                      <span className="dps-value">{formatCurrency(contributionPerAccount)}</span>
                    </div>
                    <div className="defaults-plan-stat">
                      <span className="dps-label">Penalty per Account</span>
                      <span className="dps-value penalty">{formatCurrency(defaultPerAccount)}</span>
                    </div>
                    <div className={`defaults-plan-stat ${inDefault ? 'highlight-danger' : 'highlight-safe'}`}>
                      <span className="dps-label">Total Outstanding Default</span>
                      <span className="dps-value">{formatCurrency(plan.total_default_amount)}</span>
                    </div>
                  </div>

                  {inDefault && plan.default_count > 0 && (
                    <div className="defaults-plan-warning">
                      <FaExclamationTriangle />
                      <span>
                        This program has <strong>{plan.default_count} default{plan.default_count > 1 ? 's' : ''}</strong> totaling {formatCurrency(plan.total_default_amount)}.
                        All {plan.number_of_accounts || 1} account{(plan.number_of_accounts || 1) > 1 ? 's are' : ' is'} affected.
                      </span>
                    </div>
                  )}

                  {expandedPlan === plan.plan_id && (
                    <div className="defaults-plan-details">
                      {/* Individual Defaults */}
                      {plan.defaults && plan.defaults.length > 0 && (
                        <div className="defaults-list-section">
                          <h5>Default History</h5>
                          <div className="defaults-table">
                            <div className="defaults-table-header">
                              <span>Date Missed</span>
                              <span>Penalty Amount</span>
                              <span>Status</span>
                            </div>
                            {plan.defaults.map(d => (
                              <div key={d.id} className={`defaults-table-row ${d.resolved ? 'resolved' : ''}`}>
                                <span>{new Date(d.missed_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                <span className="defaults-amount">{formatCurrency(d.penalty_amount)}</span>
                                <span>
                                  {d.resolved ? (
                                    <span className="defaults-badge safe"><FaCheckCircle /> Resolved</span>
                                  ) : (
                                    <span className="defaults-badge danger"><FaTimesCircle /> Unresolved</span>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* View Details Link (always visible) */}
                  <div className="defaults-view-details" onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/defaults/${plan.plan_id}`); }}>
                    <span>View All Accounts &amp; Full Details <FaArrowRight /></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm Clear Defaults Modal */}
      {showConfirmModal && (
        <div className="modal-overlay" onClick={() => { if (!clearLoading) setShowConfirmModal(false); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <header className="modal-header">
              <h3><FaUniversity /> Clear All Defaults</h3>
              <button className="close-btn" onClick={() => setShowConfirmModal(false)} disabled={clearLoading}>&times;</button>
            </header>

            <div className="modal-form">
              {/* Summary breakdown */}
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                <p style={{ margin: '0 0 10px', fontWeight: '600', color: '#991b1b', fontSize: '0.9rem' }}>
                  <FaExclamationTriangle style={{ marginRight: '6px' }} />
                  Outstanding Defaults Summary
                </p>
                {plans.filter(hasDefaults).map(plan => (
                  <div key={plan.plan_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#374151', padding: '4px 0', borderBottom: '1px dashed #fca5a5' }}>
                    <span>{PLAN_ICONS[plan.plan_name] || '📋'} {plan.plan_name} ({plan.default_count} default{plan.default_count > 1 ? 's' : ''})</span>
                    <span style={{ fontWeight: '600' }}>{formatCurrency(plan.total_default_amount)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: '700', color: '#dc2626', marginTop: '10px', paddingTop: '6px' }}>
                  <span>Total to Pay</span>
                  <span>{formatCurrency(totalDefaults)}</span>
                </div>
              </div>

              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 16px' }}>
                You'll be redirected to <strong>Lotus Bank's secure checkout</strong> to complete this payment. Once paid, your defaults will be cleared automatically.
              </p>

              {clearError && <p className="error-message" style={{ marginBottom: '12px' }}>{clearError}</p>}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={clearLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleClearDefaults}
                  disabled={clearLoading}
                  style={{ background: '#800020', borderColor: '#800020' }}
                >
                  {clearLoading ? 'Redirecting to Lotus...' : `🏦 Pay ${formatCurrency(totalDefaults)}`}
                </button>
              </div>

              <div className="security-notice" style={{ marginTop: '15px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.78rem', color: '#475569', textAlign: 'center' }}>
                <p style={{ margin: 0, color: '#0f172a', fontWeight: 'bold' }}>🔒 Secure Payment via Lotus Bank</p>
                <p style={{ margin: '5px 0 0' }}>You'll be redirected to Lotus Bank's secure checkout to complete payment.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Defaults;
