import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyDefaults, clearDefaults, clearDefaultById } from '../../services/api';
import { FaExclamationTriangle, FaWallet, FaShieldAlt, FaTimesCircle, FaCheckCircle, FaInfoCircle, FaArrowRight, FaClipboardList, FaMoneyBillWave, FaUniversity, FaLock, FaCreditCard } from 'react-icons/fa';
import './Dashboard.css';
import '../../components/DepositModal.css';

const PLAN_ICONS = {
  CREST: '\uD83D\uDC51',
  SILVER: '\uD83E\uDD48',
  GOLDEN_BASKET: '\uD83E\uDDFA',
  ISUSU: '\uD83D\uDD04'
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
  const [clearing, setClearing] = useState(false);
  const [clearingDefaultId, setClearingDefaultId] = useState(null);
  const [clearResult, setClearResult] = useState(null);
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

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

  const toggleExpand = (planId) => {
    setExpandedPlan(expandedPlan === planId ? null : planId);
  };

  const isDaily = (plan) => plan.plan_name === 'ISUSU';

  const periodLabel = (plan) => isDaily(plan) ? 'Daily' : 'Weekly';

  const handleClearDefaults = async () => {
    if (totalDefaults <= 0) return;
    setClearing(true);
    setError('');
    setClearResult(null);
    try {
      const { data } = await clearDefaults();
      setClearResult(data);
      setShowConfirm(false);
      await fetchDefaults();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to clear defaults. Insufficient balance?');
    } finally {
      setClearing(false);
    }
  };

  const handleClearDefault = async (defaultId, penaltyAmount) => {
    setClearingDefaultId(defaultId);
    setError('');
    setClearResult(null);
    try {
      const { data } = await clearDefaultById(defaultId);
      setClearResult(data);
      await fetchDefaults();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to clear this default. Insufficient balance?');
    } finally {
      setClearingDefaultId(null);
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
        <h2>Defaults & Penalties</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard/wallet')}>
            <FaWallet /> Fund Wallet
          </button>
          {totalDefaults > 0 && (
            <button className="btn btn-secondary" onClick={() => setShowConfirm(true)}
              disabled={clearing}
              style={{ background: '#800020', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FaCreditCard /> {clearing ? 'Processing...' : `Clear All Defaults \u2022 ${formatCurrency(totalDefaults)}`}
            </button>
          )}
        </div>
      </header>

      {/* Result Banner */}
      {clearResult && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8,
          padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12
        }}>
          <FaCheckCircle style={{ color: '#16a34a', fontSize: 20, flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong style={{ color: '#166534' }}>Defaults Cleared!</strong>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#166534' }}>
              {clearResult.message}
            </p>
          </div>
          <button onClick={() => setClearResult(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', fontWeight: 700 }}>
            &times;
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
          padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12
        }}>
          <FaTimesCircle style={{ color: '#dc2626', fontSize: 20, flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong style={{ color: '#991b1b' }}>Clearance Failed</strong>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#991b1b' }}>{error}</p>
          </div>
          <button onClick={() => setError('')}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 700 }}>
            &times;
          </button>
        </div>
      )}

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
              const totalContributionDue = contributionPerAccount * (plan.number_of_accounts || 1);

              return (
                <div
                  key={plan.plan_id}
                  className={`defaults-plan-card ${inDefault ? 'has-default' : ''}`}
                  style={{ '--plan-accent': colors.accent, '--plan-border': inDefault ? colors.border : '#e2e8f0' }}
                  onClick={() => toggleExpand(plan.plan_id)}
                >
                  <div className="defaults-plan-header">
                    <div className="defaults-plan-left">
                      <span className="defaults-plan-icon">{PLAN_ICONS[plan.plan_name] || '\uD83D\uDCCB'}</span>
                      <div>
                        <h4 className="defaults-plan-name">{plan.plan_name}</h4>
                        <span className="defaults-plan-meta">
                          {plan.number_of_accounts || 1} account{(plan.number_of_accounts || 1) > 1 ? 's' : ''}
                          {plan.plan_status === 'active' ? ' \u2022 Active' : ` \u2022 ${plan.plan_status}`}
                          {isDailyPlan && ' \u2022 Daily'}
                        </span>
                      </div>
                    </div>
                    <div className="defaults-plan-right">
                      {inDefault && (
                        <span className="defaults-badge danger">
                          <FaTimesCircle /> Defaulting
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
                      <span className="dps-label">Penalty per Account (2x)</span>
                      <span className="dps-value penalty">{formatCurrency(defaultPerAccount)}</span>
                    </div>
                    <div className="defaults-plan-stat highlight-danger">
                      <span className="dps-label">Total Outstanding Default</span>
                      <span className="dps-value">{formatCurrency(plan.total_default_amount)}</span>
                    </div>
                  </div>

                  {inDefault && plan.default_count > 0 && (
                    <div className="defaults-plan-warning">
                      <FaExclamationTriangle />
                      <span>
                        This program has <strong>{plan.default_count} default{plan.default_count > 1 ? 's' : ''}</strong> totaling {formatCurrency(plan.total_default_amount)}.
                        Each default includes the missed contribution plus an equal penalty (2x).
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
                              <span>Total Owed (2x)</span>
                              <span>Status</span>
                              <span>Action</span>
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
                                <span>
                                  {!d.resolved && (
                                    <button className="btn btn-sm btn-pay-default"
                                      onClick={(e) => { e.stopPropagation(); handleClearDefault(d.id, d.penalty_amount); }}
                                      disabled={clearingDefaultId === d.id}
                                      style={{
                                        background: clearingDefaultId === d.id ? '#94a3b8' : '#16a34a',
                                        color: '#fff', border: 'none', padding: '4px 12px',
                                        borderRadius: 4, fontSize: '0.75rem', fontWeight: 600,
                                        cursor: clearingDefaultId === d.id ? 'not-allowed' : 'pointer',
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        whiteSpace: 'nowrap'
                                      }}>
                                      {clearingDefaultId === d.id ? (
                                        <>Processing...</>
                                      ) : (
                                        <><FaWallet /> Clear</>
                                      )}
                                    </button>
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
                    <span>View All Accounts & Full Details <FaArrowRight /></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Modal — Clear Defaults via Wallet */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => { if (!clearing) setShowConfirm(false); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <header className="modal-header" style={{ background: '#800020' }}>
              <h3><FaWallet style={{ marginRight: 8 }} /> Clear Defaults via Wallet</h3>
              <button className="close-btn" onClick={() => { if (!clearing) setShowConfirm(false); }}>&times;</button>
            </header>
            <div className="modal-form">
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
                padding: '16px 20px', margin: '10px 0 20px', textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.8rem', color: '#991b1b', fontWeight: 600, marginBottom: 4 }}>
                  TOTAL OUTSTANDING DEFAULTS
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#dc2626' }}>
                  {formatCurrency(totalDefaults)}
                </div>
              </div>

              <div style={{ padding: '0 4px' }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <FaInfoCircle style={{ color: '#2563eb', fontSize: 14, marginTop: 3, flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
                    You'll be charged <strong>{formatCurrency(totalDefaults)}</strong> from your wallet balance.
                    Half of the amount goes to your missed contributions (savings), the other half settles the penalty.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <FaWallet style={{ color: '#16a34a', fontSize: 14, marginTop: 3, flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
                    Your wallet must have sufficient balance. If you can't cover all defaults at once,
                    the system will clear as many accounts as your balance allows.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <FaCheckCircle style={{ color: '#16a34a', fontSize: 14, marginTop: 3, flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
                    Defaults are processed from oldest to newest. Partial clearance is supported.
                  </p>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: 24 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowConfirm(false)} disabled={clearing}>Cancel</button>
                <button type="button" className="btn btn-primary" disabled={clearing || totalDefaults <= 0}
                  onClick={handleClearDefaults}
                  style={{ background: '#800020', borderColor: '#800020', padding: '12px 28px', fontSize: '1rem' }}>
                  {clearing ? 'Processing...' : `\u{1F4B3} Pay ${formatCurrency(totalDefaults)} from Wallet`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
};

export default Defaults;
