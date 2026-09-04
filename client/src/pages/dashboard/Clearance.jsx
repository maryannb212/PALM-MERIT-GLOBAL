import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyPlans, payClearanceAccount, getProfile } from '../../services/api';
import { FaCheckCircle, FaWallet, FaClipboardList, FaMoneyBillWave, FaShieldAlt, FaSpinner, FaCreditCard, FaArrowRight } from 'react-icons/fa';
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

const Clearance = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [payingAccount, setPayingAccount] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [plansRes, profileRes] = await Promise.all([getMyPlans(), getProfile()]);
      const allPlans = plansRes.data || [];
      const clearancePlans = allPlans.filter(p =>
        ['pending_clearance', 'pending_settlement', 'settled'].includes(p.status)
      );
      setPlans(clearancePlans);
      setWalletBalance(parseFloat(profileRes.data.available_balance || 0));
    } catch (error) {
      console.error('Failed to fetch clearance data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  const handlePayAccount = async (planId, accountIndex) => {
    setPayingAccount(`${planId}-${accountIndex}`);
    try {
      const { data } = await payClearanceAccount({ planId, accountIndex });
      alert(data.message);
      fetchData();
    } catch (error) {
      alert(error.response?.data?.message || 'Payment failed. Ensure you have enough wallet balance.');
    } finally {
      setPayingAccount(null);
    }
  };

  const handlePayAllRemaining = async (planId) => {
    if (!window.confirm('Pay clearance fees for all remaining accounts in this plan?')) return;
    setPayingAccount(`${planId}-bulk`);
    try {
      const { data } = await payClearanceAccount({ planId });
      alert(data.message);
      fetchData();
    } catch (error) {
      alert(error.response?.data?.message || 'Payment failed. Ensure you have enough wallet balance.');
    } finally {
      setPayingAccount(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending_clearance': return <span className="badge" style={{ background: '#f59e0b', color: '#fff' }}>Pending Clearance</span>;
      case 'pending_settlement': return <span className="badge" style={{ background: '#f59e0b', color: '#fff' }}>Eligibility Review</span>;
      case 'settled': return <span className="badge" style={{ background: '#10b981', color: '#fff' }}>Settled</span>;
      default: return <span className="badge badge-secondary">{status}</span>;
    }
  };

  const pendingPlans = plans.filter(p => p.status === 'pending_clearance');
  const pendingCount = pendingPlans.reduce((sum, p) => {
    const total = p.number_of_accounts || 1;
    const cleared = parseInt(p.accounts_cleared || 0, 10);
    return sum + (total - cleared);
  }, 0);
  const totalPendingFee = pendingCount * 3000;
  const canPayAny = walletBalance >= 3000;

  const statsCards = [
    {
      icon: <FaClipboardList />,
      label: 'Pending Clearance Plans',
      value: pendingPlans.length,
      color: '#f59e0b',
      bg: '#fffbeb'
    },
    {
      icon: <FaMoneyBillWave />,
      label: 'Remaining Accounts',
      value: pendingCount,
      color: '#ea580c',
      bg: '#fff7ed'
    },
    {
      icon: <FaShieldAlt />,
      label: 'Awaiting Settlement',
      value: plans.filter(p => p.status === 'pending_settlement').length,
      color: '#3b82f6',
      bg: '#eff6ff'
    },
    {
      icon: <FaCheckCircle />,
      label: 'Settled Programs',
      value: plans.filter(p => p.status === 'settled').length,
      color: '#16a34a',
      bg: '#f0fdf4'
    }
  ];

  return (
    <>
      <header className="dashboard-header">
        <h2>Program Clearance</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {pendingPlans.length > 0 && (
            <button className="btn btn-secondary" onClick={() => navigate('/dashboard/subscriptions')}
              style={{ background: '#1e293b', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FaClipboardList /> View Subscriptions
            </button>
          )}
        </div>
      </header>

      <div className="clearance-wallet-card">
        <div className="clearance-wallet-icon">
          <FaWallet />
        </div>
        <div className="clearance-wallet-info">
          <span className="clearance-wallet-label">Your Wallet Balance</span>
          <span className="clearance-wallet-value">{formatCurrency(walletBalance)}</span>
        </div>
        <button className="btn btn-primary clearance-wallet-btn" onClick={() => navigate('/dashboard/wallet')}>
          <FaCreditCard /> Fund Wallet
        </button>
      </div>

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

      <div className="defaults-section">
        <h3><FaClipboardList /> Clearance Status</h3>

        {loading ? (
          <div className="defaults-loading">Loading clearance data...</div>
        ) : plans.length === 0 ? (
          <div className="defaults-empty">
            <FaCheckCircle className="defaults-empty-icon" />
            <h4>No Programs in Clearance</h4>
            <p>You don't have any programs requiring clearance right now.</p>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard/subscriptions')}>
              View My Programs
            </button>
          </div>
        ) : (
          <div className="defaults-plans-list">
            {plans.map(plan => {
              const colors = PLAN_COLORS[plan.plan_name] || PLAN_COLORS.CREST;
              const accounts = plan.number_of_accounts || 1;
              const accountsCleared = parseInt(plan.accounts_cleared || 0, 10);
              const remaining = accounts - accountsCleared;
              const progressPct = accounts > 0 ? (accountsCleared / accounts) * 100 : 0;
              const remainingFee = remaining * 3000;

              return (
                <div key={plan.id}
                  className={`defaults-plan-card ${plan.status === 'pending_clearance' ? 'has-default' : ''}`}
                  style={{ '--plan-accent': colors.accent, '--plan-border': plan.status === 'pending_clearance' ? colors.border : '#e2e8f0' }}
                >
                  <div className="defaults-plan-header">
                    <div className="defaults-plan-left">
                      <span className="defaults-plan-icon">{PLAN_ICONS[plan.plan_name] || '📋'}</span>
                      <div>
                        <h4 className="defaults-plan-name">{plan.plan_name}</h4>
                        <span className="defaults-plan-meta">
                          {accounts} account{accounts > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="defaults-plan-right">
                      {getStatusBadge(plan.status)}
                    </div>
                  </div>

                  <div className="defaults-plan-stats">
                    <div className="defaults-plan-stat">
                      <span className="dps-label">Accounts Cleared</span>
                      <span className="dps-value">{accountsCleared} / {accounts}</span>
                    </div>
                    <div className="defaults-plan-stat">
                      <span className="dps-label">Fee per Account</span>
                      <span className="dps-value">{formatCurrency(3000)}</span>
                    </div>
                    <div className="defaults-plan-stat highlight-danger">
                      <span className="dps-label">Remaining Fee</span>
                      <span className="dps-value">{formatCurrency(remainingFee)}</span>
                    </div>
                  </div>

                  {plan.status === 'pending_clearance' && (
                    <div style={{ marginBottom: 12 }}>
                      <div className="progress-bar-container" style={{ marginBottom: 4 }}>
                        <div className="progress-bar" style={{ width: `${Math.min(100, progressPct)}%`, background: colors.accent }}></div>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{accountsCleared} of {accounts} accounts cleared ({Math.round(progressPct)}%)</span>
                    </div>
                  )}

                  {plan.status === 'pending_clearance' && remaining > 0 && (
                    <div className="clearance-actions">
                      <div className="clearance-accounts-grid">
                        {Array.from({ length: remaining }, (_, i) => {
                          const idx = accountsCleared + i;
                          const payKey = `${plan.id}-${idx}`;
                          const isPaying = payingAccount === payKey;
                          const canPayThis = walletBalance >= 3000;
                          return (
                            <button key={idx} className="clearance-account-btn"
                              onClick={() => handlePayAccount(plan.id, idx)}
                              disabled={isPaying || !canPayThis}
                              title={!canPayThis ? 'Insufficient wallet balance' : `Pay ₦3,000 for account ${idx + 1}`}>
                              {isPaying ? (
                                <><FaSpinner className="fa-spin" /> Paying...</>
                              ) : (
                                <><FaWallet /> Pay Account {idx + 1}</>
                              )}
                              <span className="clearance-account-fee">₦3,000</span>
                            </button>
                          );
                        })}
                      </div>
                      {accounts > 1 && remaining > 0 && (
                        <button className="clearance-payall-btn"
                          onClick={() => handlePayAllRemaining(plan.id)}
                          disabled={payingAccount === `${plan.id}-bulk` || !canPayAny}
                          title={!canPayAny ? 'Insufficient wallet balance' : `Pay remaining ₦${remainingFee.toLocaleString()}`}>
                          {payingAccount === `${plan.id}-bulk` ? (
                            <><FaSpinner className="fa-spin" /> Processing...</>
                          ) : (
                            <><FaArrowRight /> Pay All Remaining <span className="clearance-payall-fee">{formatCurrency(remainingFee)}</span></>
                          )}
                        </button>
                      )}
                      {!canPayAny && (
                        <div className="clearance-insufficient">
                          <FaWallet /> Insufficient balance. <a href="/dashboard/wallet" onClick={(e) => { e.preventDefault(); navigate('/dashboard/wallet'); }}>Fund your wallet</a> to continue.
                        </div>
                      )}
                    </div>
                  )}

                  {plan.status === 'pending_settlement' && (
                    <div className="defaults-plan-warning" style={{ borderLeftColor: '#3b82f6', background: '#eff6ff' }}>
                      <FaShieldAlt />
                      <span>All accounts cleared. Awaiting admin approval for payout.</span>
                    </div>
                  )}

                  {plan.status === 'settled' && (
                    <div className="defaults-plan-warning" style={{ borderLeftColor: '#16a34a', background: '#f0fdf4' }}>
                      <FaCheckCircle style={{ color: '#16a34a' }} />
                      <span style={{ color: '#166534' }}>This program has been approved and paid.</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default Clearance;
