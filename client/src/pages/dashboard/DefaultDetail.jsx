import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPlanDefaults } from '../../services/api';
import {
  FaArrowLeft, FaWallet, FaExclamationTriangle, FaTimesCircle, FaCheckCircle,
  FaMoneyBillWave, FaCalendarAlt, FaClipboardList, FaShieldAlt, FaInfoCircle,
  FaUser, FaChartLine, FaClock
} from 'react-icons/fa';
import './Dashboard.css';

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

const DefaultDetail = () => {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDetail();
  }, [planId]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const response = await getPlanDefaults(planId);
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load plan details');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="default-detail-loading">
        <div className="spinner" />
        <p>Loading plan details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="default-detail-error">
        <FaExclamationTriangle />
        <h3>Error</h3>
        <p>{error}</p>
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard/defaults')}>Back to Defaults</button>
      </div>
    );
  }

  if (!data) return null;

  const { plan, config, defaults, transactions, summary } = data;
  const colors = PLAN_COLORS[plan.plan_name] || PLAN_COLORS.CREST;
  const inDefault = summary.default_count > 0;
  const periodLabel = config.is_daily ? 'Daily' : 'Weekly';
  const periodTitle = config.is_daily ? 'today' : 'this week';
  const accountCount = plan.number_of_accounts || 1;
  const perAccountAmount = config.per_account_amount;
  const totalCycleDue = perAccountAmount * accountCount;

  const unresolvedDefaults = defaults.filter(d => !d.resolved);
  const resolvedDefaults = defaults.filter(d => d.resolved);

  const getNextCycleDate = () => {
    if (config.is_daily) return 'Every day';
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const preferredDay = plan.preferred_day || 'Friday';
    return `Every ${preferredDay}`;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active': return <span className="defaults-badge" style={{ background: '#d4edda', color: '#155724' }}>Active</span>;
      case 'completed': return <span className="defaults-badge" style={{ background: '#cce5ff', color: '#004085' }}>Completed</span>;
      case 'cancelled': return <span className="defaults-badge" style={{ background: '#f8d7da', color: '#721c24' }}>Cancelled</span>;
      default: return <span className="defaults-badge" style={{ background: '#e2e3e5', color: '#383d41' }}>{status}</span>;
    }
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'savings': return <FaChartLine style={{ color: '#16a34a' }} />;
      case 'penalty': return <FaExclamationTriangle style={{ color: '#dc2626' }} />;
      case 'penalty_settlement': return <FaCheckCircle style={{ color: '#16a34a' }} />;
      case 'deposit':
      case 'wallet_topup': return <FaWallet style={{ color: '#2563eb' }} />;
      default: return <FaMoneyBillWave style={{ color: '#64748b' }} />;
    }
  };

  return (
    <>
      <header className="dashboard-header" style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard/defaults')} style={{ padding: '8px 14px', fontSize: '0.9rem' }}>
            <FaArrowLeft /> Back
          </button>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Program Details</h2>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/dashboard/wallet')}>
          <FaWallet /> Fund Wallet
        </button>
      </header>

      {/* Plan Hero Banner */}
      <div className="dd-hero" style={{ background: `linear-gradient(135deg, ${colors.accent}15 0%, ${colors.accent}05 100%)`, borderColor: colors.accent }}>
        <div className="dd-hero-left">
          <span className="dd-hero-icon">{PLAN_ICONS[plan.plan_name] || '📋'}</span>
          <div>
            <h2 className="dd-hero-title">{plan.plan_name} Program</h2>
            <div className="dd-hero-meta">
              <span>{accountCount} Account{accountCount > 1 ? 's' : ''}</span>
              <span className="dd-meta-dot">•</span>
              <span>{config.is_daily ? 'Daily Savings' : 'Weekly Savings'}</span>
              <span className="dd-meta-dot">•</span>
              <span>{config.duration}</span>
            </div>
          </div>
        </div>
        <div className="dd-hero-right">
          {getStatusBadge(plan.status)}
          {inDefault && (
            <span className="defaults-badge danger" style={{ marginLeft: '8px' }}>
              <FaTimesCircle /> {summary.default_count} Default{summary.default_count > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="dd-stats-grid">
        <div className="dd-stat-card" style={{ '--accent': '#16a34a' }}>
          <div className="dd-stat-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
            <FaMoneyBillWave />
          </div>
          <div className="dd-stat-body">
            <span className="dd-stat-label">Total Saved</span>
            <span className="dd-stat-value">{formatCurrency(summary.total_saved)}</span>
            <span className="dd-stat-sub">of {formatCurrency(plan.target_amount)} target</span>
          </div>
          <div className="dd-stat-bar">
            <div className="dd-stat-fill" style={{ width: `${Math.min(100, (summary.total_saved / plan.target_amount) * 100)}%` }} />
          </div>
        </div>

        <div className="dd-stat-card" style={{ '--accent': '#2563eb' }}>
          <div className="dd-stat-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <FaClock />
          </div>
          <div className="dd-stat-body">
            <span className="dd-stat-label">Next Cycle</span>
            <span className="dd-stat-value">{getNextCycleDate()}</span>
            <span className="dd-stat-sub">{formatCurrency(totalCycleDue)} due {periodTitle}</span>
          </div>
        </div>

        <div className="dd-stat-card" style={{ '--accent': summary.last_payment ? '#8b5cf6' : '#94a3b8' }}>
          <div className="dd-stat-icon" style={{ background: summary.last_payment ? '#f5f3ff' : '#f1f5f9', color: summary.last_payment ? '#8b5cf6' : '#94a3b8' }}>
            <FaCalendarAlt />
          </div>
          <div className="dd-stat-body">
            <span className="dd-stat-label">Last Payment</span>
            {summary.last_payment ? (
              <>
                <span className="dd-stat-value">{formatCurrency(summary.last_payment.amount)}</span>
                <span className="dd-stat-sub">{formatDate(summary.last_payment.date)} • {summary.last_payment.type}</span>
              </>
            ) : (
              <>
                <span className="dd-stat-value">None</span>
                <span className="dd-stat-sub">No payments recorded</span>
              </>
            )}
          </div>
        </div>

        <div className="dd-stat-card" style={{ '--accent': '#dc2626' }}>
          <div className="dd-stat-icon" style={{ background: '#fef2f2', color: '#dc2626' }}>
            <FaExclamationTriangle />
          </div>
          <div className="dd-stat-body">
            <span className="dd-stat-label">Default Balance</span>
            <span className="dd-stat-value">{formatCurrency(summary.outstanding_defaults)}</span>
            <span className="dd-stat-sub">{summary.default_count} unresolved default{summary.default_count !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* Accounts Section */}
      <div className="dd-section">
        <h3><FaUser /> Accounts Under This Program</h3>
        <p className="dd-section-desc">
          This program has <strong>{accountCount} account{accountCount > 1 ? 's' : ''}</strong>.
          {inDefault ? ' All accounts are affected by the outstanding defaults below.' : ''}
        </p>

        <div className="dd-accounts-grid">
          {Array.from({ length: Math.min(accountCount, 24) }, (_, i) => (
            <div key={i} className={`dd-account-card ${inDefault ? 'dd-account-default' : ''}`}>
              <div className="dd-account-num">A-{(i + 1).toString().padStart(3, '0')}</div>
              <div className="dd-account-details">
                <div className="dd-account-row">
                  <span className="dd-account-label">{periodLabel} Contribution</span>
                  <span className="dd-account-value">{formatCurrency(perAccountAmount)}</span>
                </div>
                <div className="dd-account-row">
                  <span className="dd-account-label">Penalty (if missed)</span>
                  <span className="dd-account-value penalty">{formatCurrency(config.penalty_per_account)}</span>
                </div>
                <div className="dd-account-row">
                  <span className="dd-account-label">Status</span>
                  <span className="dd-account-value">
                    {inDefault ? (
                      <span className="defaults-badge danger" style={{ fontSize: '0.65rem' }}><FaTimesCircle /> Default</span>
                    ) : (
                      <span className="defaults-badge safe" style={{ fontSize: '0.65rem' }}><FaCheckCircle /> Active</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* All Accounts Cost Summary */}
      <div className="dd-cost-summary">
        <div className="dd-cost-item">
          <span className="dd-cost-label">{periodLabel} Contribution ({accountCount} accounts)</span>
          <span className="dd-cost-value">{formatCurrency(totalCycleDue)}</span>
        </div>
        <div className="dd-cost-item">
          <span className="dd-cost-label">Total Default Penalty ({summary.default_count} missed)</span>
          <span className="dd-cost-value penalty">{formatCurrency(summary.outstanding_defaults)}</span>
        </div>
        {inDefault && (
          <div className="dd-cost-item">
            <span className="dd-cost-label">Total to Clear All (cycle + defaults)</span>
            <span className="dd-cost-value total">{formatCurrency(totalCycleDue + summary.outstanding_defaults)}</span>
          </div>
        )}
      </div>

      {/* Defaults History */}
      {defaults.length > 0 && (
        <div className="dd-section">
          <h3><FaClipboardList /> Default History</h3>
          <div className="defaults-table">
            <div className="defaults-table-header">
              <span>Date Missed</span>
              <span>Penalty Amount</span>
              <span>Status</span>
            </div>
            {defaults.map(d => (
              <div key={d.id} className={`defaults-table-row ${d.resolved ? 'resolved' : ''}`}>
                <span>{formatDate(d.missed_date)}</span>
                <span className="defaults-amount">{formatCurrency(d.penalty_amount)}</span>
                <span>
                  {d.resolved ? (
                    <span className="defaults-badge safe"><FaCheckCircle /> Resolved {d.resolved_at ? formatDate(d.resolved_at) : ''}</span>
                  ) : (
                    <span className="defaults-badge danger"><FaTimesCircle /> Unresolved</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      {transactions.length > 0 && (
        <div className="dd-section">
          <h3><FaChartLine /> Recent Transactions</h3>
          <div className="defaults-table">
            <div className="defaults-table-header">
              <span>Date</span>
              <span>Type</span>
              <span>Amount</span>
              <span>Status</span>
            </div>
            {transactions.slice(0, 10).map(tx => (
              <div key={tx.id} className="defaults-table-row">
                <span>{formatDate(tx.created_at)}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {getTransactionIcon(tx.type)}
                  {tx.type.replace(/_/g, ' ')}
                </span>
                <span className={tx.type === 'penalty' ? 'defaults-amount' : ''} style={tx.type === 'savings' ? { color: '#16a34a', fontWeight: 700 } : {}}>
                  {formatCurrency(tx.amount)}
                </span>
                <span>
                  <span className={`status-badge ${tx.status}`}>{tx.status}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Info */}
      <div className="dd-section">
        <h3><FaInfoCircle /> Program Summary</h3>
        <div className="dd-summary-grid">
          <div className="dd-summary-item">
            <span className="dd-summary-label">Start Date</span>
            <span className="dd-summary-value">{formatDate(plan.start_date)}</span>
          </div>
          <div className="dd-summary-item">
            <span className="dd-summary-label">End Date</span>
            <span className="dd-summary-value">{formatDate(plan.end_date)}</span>
          </div>
          <div className="dd-summary-item">
            <span className="dd-summary-label">Preferred Day</span>
            <span className="dd-summary-value">{plan.preferred_day || (config.is_daily ? 'Daily' : 'Friday')}</span>
          </div>
          <div className="dd-summary-item">
            <span className="dd-summary-label">Target per Account</span>
            <span className="dd-summary-value">{formatCurrency(plan.target_amount / accountCount)}</span>
          </div>
          <div className="dd-summary-item">
            <span className="dd-summary-label">Saved per Account</span>
            <span className="dd-summary-value">{formatCurrency(summary.total_saved / accountCount)}</span>
          </div>
          <div className="dd-summary-item">
            <span className="dd-summary-label">Progress</span>
            <span className="dd-summary-value">{plan.target_amount > 0 ? `${Math.round((summary.total_saved / plan.target_amount) * 100)}%` : '0%'}</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default DefaultDetail;
