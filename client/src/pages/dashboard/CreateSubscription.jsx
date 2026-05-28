import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { subscribeToPlan } from '../../services/api';

import './Dashboard.css';

const CreateSubscription = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const plan = state?.plan;
  const method = state?.method;

  const [referralCode, setReferralCode] = useState('');
  const [autoDebit, setAutoDebit] = useState(true);
  const [numberOfAccounts, setNumberOfAccounts] = useState(method === 'multiple' ? 2 : 1);
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = daysOfWeek[new Date().getDay()];
  const [preferredDay, setPreferredDay] = useState(todayName);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // If accessed directly without a plan, redirect back to packages
  if (!plan) {
    navigate('/dashboard/packages');
    return null;
  }

  // Calculate the registration fee string and number
  const regFeeStr = plan.regFee || '₦0';
  const regFeeNum = parseInt(regFeeStr.replace(/[^0-9]/g, ''), 10) || 0;
  
  // Calculate the first initial saving amount (e.g. from ₦1,500.00 string)
  const savingAmountNum = parseFloat(plan.amount.replace(/[^0-9.]/g, '')) || 0;
  
  // Multiply based on number of accounts
  const totalRegFee = regFeeNum * numberOfAccounts;
  const totalSavingsAmount = savingAmountNum * numberOfAccounts;
  const totalInitialPayment = totalRegFee + totalSavingsAmount;
  const totalTargetSavings = plan.rawMinTarget * numberOfAccounts;
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  // Calculate End Date
  const calculateEndDate = () => {
    const today = new Date();
    if (plan.durationLabel.toLowerCase() === 'weeks') {
      today.setDate(today.getDate() + (parseInt(plan.duration, 10) * 7));
    } else if (plan.durationLabel.toLowerCase() === 'days') {
      today.setDate(today.getDate() + parseInt(plan.duration, 10));
    }
    return today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const handleCreateSubscription = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      await subscribeToPlan({
        planName: plan.id,
        method: method,
        numberOfAccounts: numberOfAccounts,
        targetAmount: totalTargetSavings,
        referralCode: referralCode !== 'NEW' ? referralCode : null,
        autoDebit: autoDebit,
        preferredDay: plan.frequency.toLowerCase() === 'weekly' ? preferredDay : null
      });
      setMessage('Subscription successful! Redirecting to dashboard...');
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to create subscription. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
        <header className="dashboard-header" style={{ marginBottom: '20px' }}>
          <h2>Create {plan.name} Subscription</h2>
        </header>

        <div className="create-subscription-container">
          <div className="subscription-card-wrapper">
            <h3 className="card-title">Create Subscription</h3>
            
            <div className="important-note-alert">
              <div className="alert-icon">⚠️</div>
              <div className="alert-content">
                <strong>Important Note</strong>
                <p>Your first payment is {formatCurrency(totalInitialPayment)}, which is {formatCurrency(totalSavingsAmount)} for your initial savings and one time {formatCurrency(totalRegFee)} for registration fee (for {numberOfAccounts} account{numberOfAccounts > 1 ? 's' : ''}).</p>
              </div>
            </div>

            <div className="subscription-details-list">
              <div className="detail-row">
                <span className="detail-label">Plan Title</span>
                <span className="detail-value">{plan.name}</span>
              </div>
              <div className="detail-row animate-fade-in" style={{ borderLeft: '3px solid var(--color-accent)', paddingLeft: '8px' }}>
                <span className="detail-label" style={{ fontWeight: '600', color: 'var(--color-primary)' }}>One-Time Registration Fee (for {numberOfAccounts} Account{numberOfAccounts > 1 ? 's' : ''})</span>
                <span className="detail-value" style={{ fontWeight: '700', color: 'var(--color-primary)' }}>{formatCurrency(totalRegFee)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">{plan.frequency.charAt(0).toUpperCase() + plan.frequency.slice(1)} Savings Amount (for {numberOfAccounts} Account{numberOfAccounts > 1 ? 's' : ''})</span>
                <span className="detail-value">{formatCurrency(totalSavingsAmount)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Duration ({plan.durationLabel})</span>
                <span className="detail-value">{plan.duration}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Target Amount (for {numberOfAccounts} Account{numberOfAccounts > 1 ? 's' : ''})</span>
                <span className="detail-value">{formatCurrency(totalTargetSavings)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">End Date</span>
                <span className="detail-value">{calculateEndDate()}</span>
              </div>
            </div>

            <div className="lifecycle-container" style={{ margin: '30px 0', padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#1e293b', fontSize: '1rem', textAlign: 'center' }}>🔄 Cooperative Savings Lifecycle</h4>
              <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '0.85rem', textAlign: 'center', lineHeight: '1.4' }}>
                PALM MERIT GLOBAL internally manages your entire savings journey. Here is how your program will progress:
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#800020', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem', flexShrink: 0 }}>1</div>
                  <div style={{ fontSize: '0.9rem', color: '#334155' }}><strong>Join Program</strong> &amp; securely deposit initial contribution.</div>
                </div>
                <div style={{ borderLeft: '2px solid #cbd5e1', height: '15px', marginLeft: '13px' }}></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#800020', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem', flexShrink: 0 }}>2</div>
                  <div style={{ fontSize: '0.9rem', color: '#334155' }}><strong>Contribute</strong> regularly towards your target.</div>
                </div>
                <div style={{ borderLeft: '2px solid #cbd5e1', height: '15px', marginLeft: '13px' }}></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#800020', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem', flexShrink: 0 }}>3</div>
                  <div style={{ fontSize: '0.9rem', color: '#334155' }}><strong>Track Progress</strong> transparently on your dashboard.</div>
                </div>
                <div style={{ borderLeft: '2px solid #cbd5e1', height: '15px', marginLeft: '13px' }}></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#800020', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem', flexShrink: 0 }}>4</div>
                  <div style={{ fontSize: '0.9rem', color: '#334155' }}><strong>Target Reached</strong> automatically flags the plan.</div>
                </div>
                <div style={{ borderLeft: '2px solid #cbd5e1', height: '15px', marginLeft: '13px' }}></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#800020', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem', flexShrink: 0 }}>5</div>
                  <div style={{ fontSize: '0.9rem', color: '#334155' }}><strong>Eligibility Review</strong> by PALM MERIT (referrals & compliance).</div>
                </div>
                <div style={{ borderLeft: '2px solid #cbd5e1', height: '15px', marginLeft: '13px' }}></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem', flexShrink: 0 }}>6</div>
                  <div style={{ fontSize: '0.9rem', color: '#334155' }}><strong>Maturity Payout</strong> is securely processed & disbursed.</div>
                </div>
              </div>
            </div>

            <form onSubmit={handleCreateSubscription} className="create-subscription-form">
              <div className="form-group" style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600', color: '#1e293b', fontSize: '0.95rem' }}>Number of Accounts</label>
                <div className="quantity-adjuster-wrapper">
                  <button 
                    type="button" 
                    className="qty-adjust-btn decrement"
                    onClick={() => setNumberOfAccounts(prev => Math.max(1, prev - 1))}
                    disabled={numberOfAccounts <= 1 || loading}
                    title="Reduce account count"
                  >
                    −
                  </button>
                  <input 
                    type="number" 
                    className="referral-input qty-adjust-input"
                    value={numberOfAccounts}
                    onChange={(e) => setNumberOfAccounts(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    required
                  />
                  <button 
                    type="button" 
                    className="qty-adjust-btn increment"
                    onClick={() => setNumberOfAccounts(prev => prev + 1)}
                    disabled={loading}
                    title="Increase account count"
                  >
                    +
                  </button>
                </div>
              </div>
              
              {plan.frequency.toLowerCase() === 'weekly' && (
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>Preferred Contribution Day</label>
                  <input 
                    type="text" 
                    className="referral-input" 
                    value={`${preferredDay} (Assigned automatically based on today's payment)`} 
                    readOnly 
                    disabled 
                    style={{ backgroundColor: '#f1f5f9', color: '#475569', cursor: 'not-allowed' }}
                  />
                </div>
              )}
              
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <input 
                  type="text" 
                  className="referral-input"
                  placeholder="Enter Referral Code or &quot;NEW&quot; if no referral" 
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  required
                />
              </div>

              <div className="wallet-balance-box">
                <div className="wb-info">
                  <h4>Wallet Balance: {formatCurrency(user?.walletBalance || user?.wallet_balance || 0)}</h4>
                  <p>Deduct savings directly from your wallet balance. <a href="/dashboard/wallet">Top up wallet.</a></p>
                </div>
              </div>

              <div className="auto-debit-toggle">
                <div className="ad-text">
                  <h4>Auto Debit Wallet</h4>
                  <p>Your due payments will be automatically debited from wallet</p>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={autoDebit} onChange={(e) => setAutoDebit(e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>

              <div className="form-action-group" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
                <button type="submit" className="btn btn-primary submit-subscription-btn" disabled={loading}>
                  {loading ? 'Processing...' : 'Create Subscription'}
                </button>
                
                <button 
                  type="button" 
                  className="btn btn-secondary cancel-subscription-btn" 
                  onClick={() => navigate('/dashboard/packages')}
                  disabled={loading}
                  style={{ width: '100%', padding: '14px', fontSize: '1.05rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer', transition: '0.2s' }}
                >
                  Cancel & Select Different Plan
                </button>
              </div>
              {message && <p className={`form-message ${message.includes('successful') ? 'success' : 'error'}`} style={{marginTop: '15px', textAlign: 'center', fontWeight: 'bold'}}>{message}</p>}
            </form>
          </div>
        </div>
    </>
  );
};

export default CreateSubscription;
