import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getMyPlans, payClearanceFee } from '../../services/api';

import './Dashboard.css';
import { FaPlus, FaCheckCircle, FaClock, FaExclamationCircle, FaHandHoldingUsd } from 'react-icons/fa';

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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  const calculateROI = (plan) => {
    if (plan.plan_name === 'CREST') return 96000;
    if (plan.plan_name === 'SILVER') return 150000;
    if (plan.plan_name === 'GOLDEN_BASKET') return plan.target_amount; // ROI in goods
    return plan.target_amount;
  };

  const filteredPlans = plans.filter(p => {
    if (activeTab === 'active') return p.status === 'active';
    if (activeTab === 'matured') return ['matured', 'pending_clearance'].includes(p.status);
    if (activeTab === 'payouts') return ['pending_settlement', 'settled'].includes(p.status);
    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active': return <span className="badge badge-success">Active</span>;
      case 'matured': return <span className="badge badge-matured">Matured</span>;
      case 'pending_clearance': return <span className="badge badge-pending-clearance">Pending Clearance</span>;
      case 'pending_settlement': return <span className="badge badge-pending-settlement">Pending Settlement</span>;
      case 'settled': return <span className="badge badge-settled">Settled</span>;
      default: return <span className="badge badge-secondary">{status}</span>;
    }
  };

  return (
    <>
        <header className="dashboard-header" style={{ marginBottom: '20px' }}>
          <h2>Portfolio & Subscriptions</h2>
        </header>

        {/* ─── Portfolio Stats ─── */}
        <div className="portfolio-grid">
          <div className="portfolio-card total-savings-card">
            <div className="pc-main-val">
              <h3>{formatCurrency(plans.reduce((sum, p) => sum + parseFloat(p.current_amount || 0), 0))}</h3>
              <p>Total Savings Portfolio</p>
            </div>
            <div className="pc-list">
              <div className="pc-list-item">
                <span>Active Savings</span>
                <strong>{formatCurrency(plans.filter(p => p.status === 'active').reduce((sum, p) => sum + parseFloat(p.current_amount || 0), 0))}</strong>
              </div>
              <div className="pc-list-item">
                <span>Pending Settlement</span>
                <strong>{formatCurrency(plans.filter(p => p.status === 'pending_settlement').reduce((sum, p) => sum + calculateROI(p), 0))}</strong>
              </div>
            </div>
          </div>

          <div className="portfolio-card subs-count-card">
            <div className="pc-header">
              <h4>Subscription Overview</h4>
              <p>{plans.filter(p => p.status === 'active').length} Active | {plans.filter(p => p.status === 'settled').length} Settled</p>
            </div>
            <div className="pc-big-num">
              <h3>{plans.length}</h3>
              <p>Total Accounts</p>
            </div>
            <div className="pc-list-sm">
              <div className="pc-list-item-sm">
                <span className="dot active-dot"></span>
                <span>Active</span>
                <strong>{plans.filter(p => p.status === 'active').length}</strong>
              </div>
              <div className="pc-list-item-sm">
                <span className="dot pending-dot"></span>
                <span>In Progress (Matured/Clearance)</span>
                <strong>{plans.filter(p => ['matured', 'pending_clearance'].includes(p.status)).length}</strong>
              </div>
              <div className="pc-list-item-sm">
                <span className="dot settled-dot"></span>
                <span>Settled</span>
                <strong>{plans.filter(p => p.status === 'settled').length}</strong>
              </div>
            </div>
          </div>
        </div>

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
            Matured/Clearance <span className="tab-badge">{plans.filter(p => ['matured', 'pending_clearance'].includes(p.status)).length}</span>
          </div>
          <div className={`subs-tab ${activeTab === 'payouts' ? 'active' : ''}`} onClick={() => setActiveTab('payouts')}>
            Payouts/Settled <span className="tab-badge">{plans.filter(p => ['pending_settlement', 'settled'].includes(p.status)).length}</span>
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
            {filteredPlans.map(plan => (
              <div key={plan.id} className="active-sub-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                  <h4 style={{ margin: 0 }}>{plan.plan_name}</h4>
                  {getStatusBadge(plan.status)}
                </div>
                
                <p><strong>Savings:</strong> {formatCurrency(plan.current_amount)} / {formatCurrency(plan.target_amount)}</p>
                <p><strong>Expected ROI:</strong> {formatCurrency(calculateROI(plan))} {plan.plan_name === 'GOLDEN_BASKET' ? '(Goods)' : ''}</p>
                
                {plan.status === 'active' && (
                  <div className="progress-bar-container">
                    <div 
                      className="progress-bar" 
                      style={{ width: `${Math.min(100, (parseFloat(plan.current_amount || 0) / parseFloat(plan.target_amount || 1)) * 100)}%` }}
                    ></div>
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
            ))}
          </div>
        )}
    </>
  );
};

export default Subscriptions;
