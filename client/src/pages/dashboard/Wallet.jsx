import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { getMyTransactions, payTshirtFee, getMyPlans, generateVirtualAccount, updateBvn } from '../../services/api';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

import './Dashboard.css';

const Wallet = () => {
  const { user, updateUser, refreshProfile } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tshirtLoading, setTshirtLoading] = useState(false);
  const [hideBalances, setHideBalances] = useState(true);
  const [plans, setPlans] = useState([]);
  const [vaLoading, setVaLoading] = useState(false);
  const [vaError, setVaError] = useState('');
  const [vaSuccess, setVaSuccess] = useState('');
  const [copied, setCopied] = useState(false);
  const [showBvnModal, setShowBvnModal] = useState(false);
  const [bvnValue, setBvnValue] = useState('');
  const [bvnError, setBvnError] = useState('');
  const [bvnSubmitting, setBvnSubmitting] = useState(false);
  const [bvnSuccess, setBvnSuccess] = useState('');


  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const { data } = await getMyPlans();
        setPlans(data || []);
      } catch (err) {
        console.error('Error fetching plans in wallet:', err);
      }
    };
    fetchPlans();
  }, []);

  const oldestPlan = plans.reduce((oldest, p) => {
    if (!oldest) return p;
    return new Date(p.created_at) < new Date(oldest.created_at) ? p : oldest;
  }, null);



  const isClearanceDue = plans.some(p => 
    ['matured', 'pending_clearance'].includes(p.status) && p.clearance_required
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (refreshProfile) await refreshProfile();
        const response = await getMyTransactions();
        setTransactions(response.data || []);
      } catch (error) {
        console.error('Failed to fetch transactions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    const handleFocus = () => {
      if (refreshProfile) refreshProfile();
      getMyTransactions().then(res => setTransactions(res.data || [])).catch(() => {});
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const handleTshirtPayment = async () => {
    if (availableBalance < 5000) {
      alert('Insufficient available balance. Please top up your wallet first.');
      return;
    }
    
    if (!window.confirm('Are you sure you want to pay ₦5,000 for your Incentive T-Shirt?')) return;

    setTshirtLoading(true);
    try {
      await payTshirtFee();
      updateUser({ tshirt_paid: true });
      alert('T-Shirt payment successful!');
      window.location.reload();
    } catch (error) {
      alert(error.response?.data?.message || 'Payment failed');
    } finally {
      setTshirtLoading(false);
    }
  };

  const handleBvnChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 11);
    setBvnValue(val);
    setBvnError('');
    setBvnSuccess('');
  };

  const handleBvnSubmit = async () => {
    if (bvnValue.length !== 11) {
      setBvnError('BVN must be exactly 11 digits');
      return;
    }
    setBvnSubmitting(true);
    setBvnError('');
    setBvnSuccess('');
    try {
      await updateBvn(bvnValue);
      setBvnSuccess('BVN submitted successfully!');
      await refreshProfile();
      setTimeout(() => {
        setShowBvnModal(false);
        setBvnValue('');
        setBvnSuccess('');
      }, 1500);
    } catch (err) {
      setBvnError(err.response?.data?.message || 'Failed to update BVN');
    } finally {
      setBvnSubmitting(false);
    }
  };

  const handleGenerateVA = async () => {
    setVaLoading(true);
    setVaError('');
    setVaSuccess('');
    try {
      const { data } = await generateVirtualAccount();
      updateUser({
        virtual_account_number: data.virtual_account_number,
        virtual_bank_name: data.virtual_bank_name,
        virtual_account_name: data.virtual_account_name
      });
      setVaSuccess(data.message || 'Virtual account created successfully!');
      await refreshProfile();
    } catch (err) {
      setVaError(err.response?.data?.message || 'Failed to generate virtual account');
    } finally {
      setVaLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  const availableBalance = parseFloat(user?.available_balance || 0);
  const heldBalance = parseFloat(user?.held_balance || 0);
  const walletBalance = parseFloat(user?.walletBalance || user?.wallet_balance || 0);

  const totalCredit = transactions
    .filter(t => (t.type === 'deposit' || t.type === 'wallet_topup') && t.status === 'completed')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const totalDebit = transactions
    .filter(t => (t.type === 'withdrawal' || t.type === 'subscription' || t.type === 'clearance' || t.type === 'membership') && t.status === 'completed')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  return (
    <>
        <header className="dashboard-header">
          <h2>My Wallet</h2>
        </header>

        {/* ─── Settlement & Funding Section ─── */}
        <div className="virtual-account-card">
          <div className="virtual-account-info">
            <h3>Settlement Account</h3>
            <p>Funds will be sent here upon withdrawal. Update your bank details anytime.</p>
            <div className="virtual-account-actions" style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
              <Link to="/dashboard/bank-details" className="btn btn-sm btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                Manage Bank Details
              </Link>
              <button disabled className="btn btn-sm btn-warning" style={{ padding: '8px 16px', fontSize: '0.85rem', opacity: 0.6, cursor: 'not-allowed' }} title="Withdrawals are currently disabled">
                Withdraw Funds
              </button>
            </div>
          </div>
          <div className="virtual-account-balance" onClick={() => setHideBalances(!hideBalances)} style={{ cursor: 'pointer' }}>
            <span className="label" style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end' }}>
              Wallet Balance 
              <button onClick={(e) => { e.stopPropagation(); refreshProfile(); }} style={{ background: 'none', border: 'none', color: '#ff781f', cursor: 'pointer', fontSize: '0.85rem', padding: '0', textDecoration: 'underline' }} title="Refresh balance">
                &#x21bb;
              </button>
              <span style={{ fontSize: '0.85rem', color: '#ff781f' }}>({hideBalances ? 'Show' : 'Hide'})</span>
            </span>
            <span className="amount">
              {hideBalances ? (
                <span style={{ fontSize: '1.4rem', letterSpacing: '2px' }}>••••••</span>
              ) : (
                formatCurrency(walletBalance)
              )}
            </span>
          </div>
        </div>

        {/* ─── Virtual Account Card ─── */}
        <div className="virtual-account-card" style={{ border: '1px solid rgba(128, 0, 32, 0.15)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)' }}>
          <div className="card-header" style={{ background: 'linear-gradient(135deg, #800020, #4a0012)', color: 'white', borderBottom: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>🏦</span>
            <div style={{ textAlign: 'left' }}>
              <h3 style={{ margin: 0, color: '#FFD700', fontSize: '1.2rem', fontWeight: 'bold' }}>Virtual Bank Account</h3>
              <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.85 }}>Receive transfers directly to this account</p>
            </div>
          </div>
          <div className="card-body" style={{ padding: '25px' }}>
            {user?.virtual_account_number ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                  <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <label style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Account Number</label>
                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#0f172a', fontFamily: 'monospace', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {user.virtual_account_number}
                      <button onClick={() => handleCopy(user.virtual_account_number)} style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '0.75rem', color: '#475569' }}>Copy</button>
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <label style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bank Name</label>
                    <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#0f172a', marginTop: '5px' }}>{user.virtual_bank_name}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <label style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Account Name</label>
                    <div style={{ fontSize: '1.05rem', fontWeight: '600', color: '#0f172a', marginTop: '5px' }}>{user.virtual_account_name}</div>
                  </div>
                </div>
                <p style={{ margin: '5px 0 0', fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>
                  Transfer any amount to this account. Your wallet will be credited automatically.
                </p>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                {vaSuccess && (
                  <div style={{ background: '#d4edda', color: '#155724', padding: '12px 16px', borderRadius: '8px', marginBottom: '15px', fontSize: '0.9rem' }}>
                    ✅ {vaSuccess}
                  </div>
                )}
                {vaError && (
                  <div style={{ background: '#f8d7da', color: '#721c24', padding: '12px 16px', borderRadius: '8px', marginBottom: '15px', fontSize: '0.9rem' }}>
                    ❌ {vaError}
                  </div>
                )}
                {user?.bvn ? (
                  <>
                    <p style={{ color: '#64748b', marginBottom: '15px' }}>
                      Get a dedicated bank account number to receive transfers directly.
                    </p>
                    <button
                      onClick={handleGenerateVA}
                      className="btn btn-primary"
                      disabled={vaLoading}
                      style={{ padding: '12px 30px', fontSize: '1rem', borderRadius: '6px' }}
                    >
                      {vaLoading ? 'Generating...' : '🏦 Generate Virtual Account'}
                    </button>
                  </>
                ) : (
                  <>
                    <p style={{ color: '#64748b', marginBottom: '15px' }}>
                      Provide your BVN to generate a dedicated virtual bank account.
                    </p>
                    <button
                      onClick={() => setShowBvnModal(true)}
                      className="btn btn-primary"
                      style={{ padding: '12px 30px', fontSize: '1rem', borderRadius: '6px' }}
                    >
                      Provide BVN
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── T-Shirt Reminder Banner ─── */}
        {!user?.tshirt_paid && isClearanceDue && (
          <div className="tshirt-banner">
            <div className="tshirt-content">
              <div className="tshirt-icon">👕</div>
              <div className="tshirt-text">
                <h4>Incentive T-Shirt Payment Required</h4>
                <p>To participate in PROGRAMMES and collect payouts, please pay your ₦5,000 T-shirt fee.</p>
              </div>
            </div>
            <button 
              className="tshirt-btn" 
              onClick={handleTshirtPayment}
              disabled={tshirtLoading}
            >
              {tshirtLoading ? 'Processing...' : 'Pay Now'}
            </button>
          </div>
        )}

        {/* ─── Stats Row ─── */}
        <div className="stats-grid stats-grid-wallet" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          <div className="stat-card wallet-balance-card" onClick={() => setHideBalances(!hideBalances)} style={{ cursor: 'pointer' }}>
            <div className="stat-icon">💰</div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              Available Balance
              <span style={{ fontSize: '0.8rem', color: '#ff781f', textDecoration: 'underline' }}>({hideBalances ? 'Show' : 'Hide'})</span>
            </h3>
            <div className="stat-value">
              {hideBalances ? (
                <span style={{ fontSize: '1.5rem', letterSpacing: '3px' }}>••••••</span>
              ) : (
                formatCurrency(availableBalance)
              )}
            </div>
          </div>
          <div className="stat-card credit-card" style={{ background: '#fff3cd', cursor: 'pointer' }} onClick={() => setHideBalances(!hideBalances)}>
            <div className="stat-icon">🔒</div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              Held Balance
              <span style={{ fontSize: '0.8rem', color: '#ff781f', textDecoration: 'underline' }}>({hideBalances ? 'Show' : 'Hide'})</span>
            </h3>
            <div className="stat-value">
              {hideBalances ? (
                <span style={{ fontSize: '1.5rem', letterSpacing: '3px' }}>••••••</span>
              ) : (
                formatCurrency(heldBalance)
              )}
            </div>
          </div>
        </div>

        {/* ─── Transaction History Section ─── */}
        <div className="transaction-history-section">
          <h3>Transaction History</h3>
          
          <div className="table-controls">
            <div className="filters">
              <select className="control-select">
                <option>All time</option>
              </select>
              <select className="control-select">
                <option>All Orders</option>
              </select>
            </div>
            <div className="search-box">
              <input type="text" placeholder="Search Order" className="control-input" />
            </div>
          </div>

          <div className="table-responsive">
            <table className="transaction-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="empty-table-msg">Loading transactions...</td>
                  </tr>
                ) : transactions.length > 0 ? (
                  transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td>{tx.plan_name ? `Subscription: ${tx.plan_name}` : (tx.type.charAt(0).toUpperCase() + tx.type.slice(1))}</td>
                      <td>{new Date(tx.created_at).toLocaleDateString()}</td>
                      <td>{formatCurrency(tx.amount)}</td>
                      <td>
                        <span className={`badge ${tx.type === 'deposit' || tx.type === 'wallet_topup' ? 'badge-success' : 'badge-warning'}`} style={{ 
                          color: (tx.type === 'deposit' || tx.type === 'wallet_topup') ? '#155724' : '#856404', 
                          background: (tx.type === 'deposit' || tx.type === 'wallet_topup') ? '#d4edda' : '#fff3cd' 
                        }}>
                          {tx.type}
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={{
                          background: tx.status === 'completed' ? '#d4edda' : (tx.status === 'failed' ? '#f8d7da' : (tx.status === 'cancelled' ? '#e9ecef' : '#fff3cd')),
                          color: tx.status === 'completed' ? '#155724' : (tx.status === 'failed' ? '#721c24' : (tx.status === 'cancelled' ? '#6c757d' : '#856404'))
                        }}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="empty-table-msg">No data available in table</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="table-footer">
            <select className="control-select pagination-select">
              <option>10</option>
              <option>25</option>
              <option>50</option>
              <option>100</option>
            </select>
          </div>
        </div>
      {showBvnModal && (
        <div className="bvn-modal-overlay" onClick={() => { if (!bvnSubmitting) { setShowBvnModal(false); setBvnError(''); setBvnSuccess(''); setBvnValue(''); } }}>
          <div className="bvn-modal-card" onClick={e => e.stopPropagation()}>
            <button className="bvn-modal-close" onClick={() => { setShowBvnModal(false); setBvnError(''); setBvnSuccess(''); setBvnValue(''); }} disabled={bvnSubmitting}>
              ✕
            </button>
            <div className="bvn-modal-icon">🔐</div>
            <h3 className="bvn-modal-title">Enter Your BVN</h3>
            <p className="bvn-modal-desc">
              Your Bank Verification Number (BVN) is required to generate a dedicated virtual bank account for receiving transfers.
            </p>
            {bvnSuccess && (
              <div className="bvn-alert bvn-alert-success">{bvnSuccess}</div>
            )}
            {bvnError && (
              <div className="bvn-alert bvn-alert-error">{bvnError}</div>
            )}
            <div className="bvn-input-group">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Enter 11-digit BVN"
                value={bvnValue}
                onChange={handleBvnChange}
                maxLength={11}
                className="bvn-input"
                disabled={bvnSubmitting}
                autoFocus
              />
              <div className="bvn-counter">{bvnValue.length}/11</div>
            </div>
            <div className="bvn-modal-actions">
              <button
                className="bvn-btn bvn-btn-cancel"
                onClick={() => { setShowBvnModal(false); setBvnError(''); setBvnSuccess(''); setBvnValue(''); }}
                disabled={bvnSubmitting}
              >
                Cancel
              </button>
              <button
                className="bvn-btn bvn-btn-submit"
                onClick={handleBvnSubmit}
                disabled={bvnSubmitting || bvnValue.length !== 11}
              >
                {bvnSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Wallet;
