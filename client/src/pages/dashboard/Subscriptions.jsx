import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getMyPlans, payClearanceFee, cancelSubscription } from '../../services/api';

import './Dashboard.css';
import { FaPlus, FaCheckCircle, FaClock, FaExclamationCircle, FaHandHoldingUsd, FaTrash } from 'react-icons/fa';

const Subscriptions = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await getMyPlans();
      setPlans(response.data || []);
    } catch (error) {
      console.error('Failed to fetch subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayClearance = async (planId) => {
    if (!user?.tshirt_paid) {
      alert('T-Shirt Payment Required: You must pay your Incentive T-Shirt fee (₦5,000) under the Wallet tab before you can pay clearance fees and collect payouts.');
      navigate('/dashboard/wallet');
      return;
    }

    if (!window.confirm('Pay ₦3,000 clearance fee from your wallet balance?')) return;
    
    setActionLoading(true);
    try {
      await payClearanceFee({ planId });
      alert('Clearance fee paid! Your plan is now pending settlement.');
      fetchPlans();
    } catch (error) {
      alert(error.response?.data?.message || 'Payment failed. Ensure you have enough wallet balance.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSubscription = async (planId) => {
    if (!window.confirm('Are you sure you want to delete this subscription? Any saved funds will be refunded to your wallet balance.')) return;
    
    setActionLoading(true);
    try {
      await cancelSubscription(planId);
      alert('Subscription cancelled successfully.');
      fetchPlans();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to cancel subscription.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  const calculateROI = (plan) => {
    return plan.target_amount;
  };

  const filteredPlans = plans.filter(p => {
    if (activeTab === 'active') return p.status === 'active';
    if (activeTab === 'matured') return ['matured', 'pending_clearance', 'eligibility_review'].includes(p.status);
    if (activeTab === 'payouts') return ['pending_settlement', 'settled'].includes(p.status);
    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active': return <span className="badge badge-success">Active</span>;
      case 'eligibility_review': return <span className="badge" style={{ background: '#f59e0b', color: '#fff' }}>Eligibility Review</span>;
      case 'matured': return <span className="badge" style={{ background: '#f59e0b', color: '#fff' }}>Eligibility Review</span>;
      case 'pending_clearance': return <span className="badge" style={{ background: '#f59e0b', color: '#fff' }}>Pending Clearance</span>;
      case 'pending_settlement': return <span className="badge" style={{ background: '#3b82f6', color: '#fff' }}>Approved for Payout</span>;
      case 'settled': return <span className="badge" style={{ background: '#10b981', color: '#fff' }}>Paid</span>;
      default: return <span className="badge badge-secondary">{status}</span>;
    }
  };

  return (
    <>
        <header className="dashboard-header" style={{ marginBottom: '20px' }}>
          <h2>Portfolio & Subscriptions</h2>
        </header>

        {/* ─── Portfolio Stats ─── */}
        <div className="cooperative-overview-banner" style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', color: 'white', padding: '25px', borderRadius: '12px', marginBottom: '25px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#ff781f' }}>🛡️ Personal Savings Hub</h3>
          <p style={{ margin: '8px 0 20px 0', opacity: 0.9, fontSize: '0.95rem' }}>
            Build your future discreetly and securely. Manage each of your active cooperative programs below on a granular, subscription-focused basis.
          </p>
          <div className="portfolio-stats-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px', borderLeft: '3px solid #ff781f' }}>
              <span style={{ fontSize: '0.85rem', opacity: 0.8, display: 'block', marginBottom: '5px' }}>Active Savings Programs</span>
              <strong style={{ fontSize: '1.5rem' }}>{plans.filter(p => p.status === 'active').length}</strong>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px', borderLeft: '3px solid #3b82f6' }}>
              <span style={{ fontSize: '0.85rem', opacity: 0.8, display: 'block', marginBottom: '5px' }}>In Review / Clearance</span>
              <strong style={{ fontSize: '1.5rem' }}>{plans.filter(p => ['matured', 'eligibility_review', 'pending_clearance'].includes(p.status)).length}</strong>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px', borderLeft: '3px solid #10b981' }}>
              <span style={{ fontSize: '0.85rem', opacity: 0.8, display: 'block', marginBottom: '5px' }}>Settled Accounts</span>
              <strong style={{ fontSize: '1.5rem' }}>{plans.filter(p => p.status === 'settled').length}</strong>
            </div>
          </div>
        </div>

        {/* ─── T-Shirt Reminder Banner ─── */}
        {!user?.tshirt_paid && plans.some(p => ['matured', 'pending_clearance'].includes(p.status) && p.clearance_required) && (
          <div className="tshirt-banner animate-fade-in" style={{ marginBottom: '20px' }}>
            <div className="tshirt-content">
              <div className="tshirt-icon">👕</div>
              <div className="tshirt-text">
                <h4>Incentive T-Shirt Payment Required</h4>
                <p>Your program clearance is now due! Please pay your ₦5,000 T-shirt fee under the Wallet tab to unlock clearance payments and collect payouts.</p>
              </div>
            </div>
            <button 
              className="tshirt-btn" 
              onClick={() => navigate('/dashboard/wallet')}
            >
              Go to Wallet
            </button>
          </div>
        )}

        <div className="my-subscriptions-header">
          <h3>My Subscriptions</h3>
          <button className="btn btn-primary add-sub-btn" onClick={() => navigate('/dashboard/packages')}>
            <FaPlus /> Add Subscription
          </button>
        </div>

        <div className="subs-tabs">
          <div className={`subs-tab ${activeTab === 'active' ? 'active' : ''}`} onClick={() => setActiveTab('active')}>
            Active <span className="tab-badge">{plans.filter(p => p.status === 'active').length}</span>
          </div>
          <div className={`subs-tab ${activeTab === 'matured' ? 'active' : ''}`} onClick={() => setActiveTab('matured')}>
            Eligibility Review <span className="tab-badge">{plans.filter(p => ['matured', 'eligibility_review', 'pending_clearance'].includes(p.status)).length}</span>
          </div>
          <div className={`subs-tab ${activeTab === 'payouts' ? 'active' : ''}`} onClick={() => setActiveTab('payouts')}>
            Approved & Paid <span className="tab-badge">{plans.filter(p => ['pending_settlement', 'settled'].includes(p.status)).length}</span>
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', marginTop: '40px' }}>Loading subscriptions...</p>
        ) : filteredPlans.length === 0 ? (
          <div className="empty-subscriptions-state">
            <p>No plans found in this category.</p>
            {activeTab === 'active' && (
              <button className="btn btn-primary btn-lg" onClick={() => navigate('/dashboard/packages')}>
                Subscribe to Savings Plans
              </button>
            )}
          </div>
        ) : (
          <div className="active-subscriptions-list">
            {filteredPlans.map(plan => {
              const individualTarget = parseFloat(plan.target_amount || 0) / (plan.number_of_accounts || 1);
              const individualSaved = parseFloat(plan.current_amount || 0) / (plan.number_of_accounts || 1);
              const individualRemaining = Math.max(0, individualTarget - individualSaved);
              const individualROI = calculateROI(plan) / (plan.number_of_accounts || 1);

              const getWeeklySavingsAmount = (planName) => {
                if (planName === 'CREST') return '₦4,000';
                if (planName === 'SILVER') return '₦1,500';
                if (planName === 'GOLDEN_BASKET') return '₦2,000';
                if (planName === 'ISUSU') return '₦500 Daily (Min)';
                return '₦500';
              };

              return (
                <div key={plan.id} className="active-sub-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                    <h4 style={{ margin: 0 }}>{plan.plan_name} Programme {plan.number_of_accounts > 1 && <span className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 'normal' }}>({plan.number_of_accounts} accounts)</span>}</h4>
                    {getStatusBadge(plan.status)}
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '15px', fontSize: '0.9rem' }}>
                    <p style={{ margin: 0 }}><strong>Target Savings:</strong> {formatCurrency(individualTarget)}</p>
                    <p style={{ margin: 0 }}><strong>{plan.plan_name === 'ISUSU' ? 'Daily Savings:' : 'Weekly Savings:'}</strong> {getWeeklySavingsAmount(plan.plan_name)}</p>
                    <p style={{ margin: 0 }}><strong>Saved:</strong> {formatCurrency(individualSaved)}</p>
                    <p style={{ margin: 0 }}><strong>Remaining:</strong> {formatCurrency(individualRemaining)}</p>
                    <p style={{ margin: 0 }}><strong>Schedule:</strong> {plan.preferred_day || (plan.plan_name === 'ISUSU' ? 'Daily' : 'Friday')}</p>
                    <p style={{ margin: 0 }}><strong>Expected ROI:</strong> {formatCurrency(individualROI)} {plan.plan_name === 'GOLDEN_BASKET' ? '(Goods)' : ''}</p>
                  </div>
                  
                  {plan.status === 'active' && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                      <div className="progress-bar-container" style={{ flex: 1, marginRight: '15px', marginBottom: 0 }}>
                        <div 
                          className="progress-bar" 
                          style={{ width: `${Math.min(100, (parseFloat(plan.current_amount || 0) / parseFloat(plan.target_amount || 1)) * 100)}%` }}
                        ></div>
                      </div>
                      <button 
                        className="btn btn-secondary btn-sm" 
                        style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}
                        onClick={() => handleCancelSubscription(plan.id)}
                        disabled={actionLoading}
                      >
                        <FaTrash /> Delete
                      </button>
                    </div>
                  )}

                  {plan.status === 'eligibility_review' && (
                    <div className="payout-info">
                      <FaExclamationCircle /> 
                      <span>Your plan is currently undergoing Eligibility Review for referral bonuses.</span>
                    </div>
                  )}

                  {plan.status === 'pending_clearance' && (
                    <button 
                      className="clearance-btn" 
                      onClick={() => handlePayClearance(plan.id)}
                      disabled={actionLoading}
                    >
                      <FaHandHoldingUsd /> {actionLoading ? 'Processing...' : 'Pay Clearance Fee (₦3,000)'}
                    </button>
                  )}

                  {plan.status === 'pending_settlement' && (
                    <div className="payout-info">
                      <FaClock /> 
                      <span>Settlement Date: {new Date(plan.payout_date).toLocaleDateString()}</span>
                    </div>
                  )}

                  {plan.status === 'settled' && (
                    <div className="payout-info" style={{ color: '#16a34a' }}>
                      <FaCheckCircle /> 
                      <span>Settlement Completed</span>
                    </div>
                  )}

                  {plan.status === 'matured' && plan.plan_name === 'GOLDEN_BASKET' && (
                     <div className="payout-info">
                       <FaExclamationCircle /> 
                       <span>Waiting for system update to Clearance-free status...</span>
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

export default Subscriptions;
