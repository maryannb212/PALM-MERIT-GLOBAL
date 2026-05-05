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
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // If accessed directly without a plan, redirect back to packages
  if (!plan) {
    navigate('/dashboard/packages');
    return null;
  }

  // Calculate the registration fee string and number
  const regFeeMatch = plan.description.match(/₦[\d,]+/);
  const regFeeStr = regFeeMatch ? regFeeMatch[0] : '₦0';
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
        autoDebit: autoDebit
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

            <form onSubmit={handleCreateSubscription} className="create-subscription-form">
              {method === 'multiple' && (
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>Number of Accounts</label>
                  <input 
                    type="number" 
                    className="referral-input"
                    value={numberOfAccounts}
                    onChange={(e) => setNumberOfAccounts(Math.max(2, parseInt(e.target.value) || 2))}
                    min="2"
                    required
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
                  <h4>Wallet Balance: {formatCurrency(user?.wallet_balance || 0)}</h4>
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

              <button type="submit" className="btn btn-primary submit-subscription-btn" disabled={loading}>
                {loading ? 'Processing...' : 'Create Subscription'}
              </button>
              {message && <p className={`form-message ${message.includes('successful') ? 'success' : 'error'}`} style={{marginTop: '15px', textAlign: 'center', fontWeight: 'bold'}}>{message}</p>}
            </form>
          </div>
        </div>
    </>
  );
};

export default CreateSubscription;
