import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToPlan } from '../../services/api';

import './Dashboard.css';

const PACKAGES = [
  {
    id: 'CREST',
    name: 'CREST Programme',
    subscribers: '279 Subscribed',
    description: '3 Months (90 Days) / 12 Weeks Saving Program. Registration fee is ₦3,000.',
    amount: '₦4,000.00',
    frequency: 'weekly',
    duration: '12',
    durationLabel: 'Weeks',
    targetSavings: '₦48,000',
    targetWithdrawal: '₦48,000',
    rawMinTarget: 48000
  },
  {
    id: 'SILVER',
    name: 'SILVER Programme',
    subscribers: '3,256 Subscribed',
    description: '12 Months (360 Days) / 50 Weeks Savings Program. Registration fee is ₦2,500.',
    amount: '₦1,500.00',
    frequency: 'weekly',
    duration: '50',
    durationLabel: 'Weeks',
    targetSavings: '₦75,000',
    targetWithdrawal: '₦75,000',
    rawMinTarget: 75000
  },
  {
    id: 'GOLDEN_BASKET',
    name: 'GOLDEN BASKET Programme',
    subscribers: '786,235 Subscribed',
    description: '12 Months (360 Days) / 50 Weeks Savings Program. Registration fee is ₦3,000.',
    amount: '₦2,000.00',
    frequency: 'weekly',
    duration: '50',
    durationLabel: 'Weeks',
    targetSavings: '₦100,000',
    targetWithdrawal: '₦100,000',
    rawMinTarget: 100000
  },
  {
    id: 'ISUSU',
    name: 'ISUSU Daily Savings',
    subscribers: '45,102 Subscribed',
    description: 'Daily Savings for 1 Month (30 Days). System deducts amount saved daily after every 30 days maturity.',
    amount: '₦500.00',
    frequency: 'daily (min)',
    duration: '30',
    durationLabel: 'Days',
    targetSavings: '₦15,000',
    targetWithdrawal: '₦15,000',
    rawMinTarget: 15000
  }
];

const Packages = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [creationMethod, setCreationMethod] = useState('single');
  const [message, setMessage] = useState('');

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!selectedPlan) return;
    
    // Pass the selected plan and creation method state to the new subscription page
    navigate('/dashboard/packages/subscribe', { 
      state: { 
        plan: selectedPlan, 
        method: creationMethod 
      } 
    });
  };

  const handleSelectPlan = (pkg) => {
    setSelectedPlan(pkg);
    setCreationMethod('single');
  };

  return (
    <>
        <header className="packages-header-section">
          <h2>ORGANISATIONAL PROGRAMMES</h2>
          <p>PLEASE SELECT A PACKAGE THAT BEST FITS YOUR BUDGET/PLAN</p>
        </header>

        <div className="plans-grid">
          {PACKAGES.map((pkg) => (
            <div 
              key={pkg.id} 
              className={`plan-card ${selectedPlan?.id === pkg.id ? 'selected' : ''}`}
              onClick={() => handleSelectPlan(pkg)}
            >
              <div className="plan-card-header">
                <h3>{pkg.name}</h3>
                <span className="plan-subscribers">{pkg.subscribers}</span>
              </div>
              
              <p className="plan-desc">{pkg.description}</p>
              
              <div className="plan-stats-grid">
                <div className="plan-stat">
                  <h4>{pkg.amount}</h4>
                  <span>{pkg.frequency}</span>
                </div>
                <div className="plan-stat">
                  <h4>{pkg.duration}</h4>
                  <span>{pkg.durationLabel}</span>
                </div>
                <div className="plan-stat">
                  <h4>{pkg.targetSavings}</h4>
                  <span>Target Savings</span>
                </div>
                <div className="plan-stat">
                  <h4>{pkg.targetWithdrawal}</h4>
                  <span>Target Withdral</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {selectedPlan && (
          <div className="account-creation-overlay" onClick={() => setSelectedPlan(null)}>
            <div className="account-creation-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Choose An Account Creation Method</h3>
                <button className="modal-close" onClick={() => setSelectedPlan(null)}>✕</button>
              </div>
              <div className="modal-body">
                <p className="modal-disclaimer">
                  You're about to join the Savings. By proceeding, you agree to pay <strong>{selectedPlan.description.match(/₦[\d,]+/)?.[0] || '₦3,000'}</strong> for registration and contribute <strong>{selectedPlan.amount}</strong> {selectedPlan.frequency} for weeks and abide by the group's terms.
                </p>

                <div className="creation-methods">
                  <div 
                    className={`method-card ${creationMethod === 'single' ? 'active' : ''}`}
                    onClick={() => setCreationMethod('single')}
                  >
                    <div className="method-icon single-icon">👤</div>
                    <div className="method-text">
                      <h4>Create A Single Account</h4>
                      <p>Create a single account</p>
                    </div>
                  </div>

                  <div 
                    className={`method-card ${creationMethod === 'multiple' ? 'active' : ''}`}
                    onClick={() => setCreationMethod('multiple')}
                  >
                    <div className="method-icon multiple-icon">👥</div>
                    <div className="method-text">
                      <h4>Create Multiple Account</h4>
                      <p>Create more than one account at a time</p>
                    </div>
                  </div>
                </div>

                <button 
                  className="btn btn-primary continue-btn" 
                  onClick={handleSubscribe} 
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Continue'}
                </button>
                {message && <p className={`form-message ${message.includes('successful') ? 'success' : 'error'}`} style={{marginTop: '15px', textAlign: 'center', fontWeight: 'bold'}}>{message}</p>}
              </div>
            </div>
          </div>
        )}
    </>

  );
};

export default Packages;
