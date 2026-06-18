import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { getMyTransactions, payTshirtFee, getMyPlans, generateVirtualAccount } from '../../services/api';
import DepositModal from '../../components/DepositModal';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

import './Dashboard.css';

const Wallet = () => {
  const { user, updateUser, refreshProfile } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tshirtLoading, setTshirtLoading] = useState(false);
  const [hideBalances, setHideBalances] = useState(true);
  const [plans, setPlans] = useState([]);
  const [vaLoading, setVaLoading] = useState(false);
  const [vaError, setVaError] = useState('');


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
    const fetchTransactions = async () => {
      try {
        if (refreshProfile) {
          await refreshProfile();
        }
        const response = await getMyTransactions();
        setTransactions(response.data || []);
      } catch (error) {
        console.error('Failed to fetch transactions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
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

  const handleGenerateVA = async () => {
    setVaLoading(true);
    setVaError('');
    try {
      const { data } = await generateVirtualAccount();
      updateUser({
        virtual_account_number: data.virtual_account_number,
        virtual_bank_name: data.virtual_bank_name,
        virtual_account_name: data.virtual_account_name
      });
      alert('Virtual account created successfully!');
    } catch (err) {
      setVaError(err.response?.data?.message || 'Failed to generate virtual account');
    } finally {
      setVaLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
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
                {user?.kycStatus === 'verified' && user?.bvn ? (
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
                  <div>
                    <p style={{ color: '#64748b', marginBottom: '10px', fontSize: '0.95rem' }}>
                      Complete your KYC verification to unlock a dedicated virtual bank account.
                    </p>
                    <Link to="/dashboard/kyc" className="btn btn-secondary" style={{ padding: '12px 30px', fontSize: '1rem', borderRadius: '6px', textDecoration: 'none', display: 'inline-block' }}>
                      Complete KYC
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── Fund Wallet / Generate VA / KYC ─── */}
        <div className="funding-account-section card mt-4" style={{ border: '1px solid rgba(128, 0, 32, 0.15)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)' }}>
          <div className="card-header" style={{ background: 'linear-gradient(135deg, #800020, #4a0012)', color: 'white', borderBottom: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>🏦</span>
            <div style={{ textAlign: 'left' }}>
              <h3 style={{ margin: 0, color: '#FFD700', fontSize: '1.2rem', fontWeight: 'bold' }}>
                {user?.virtual_account_number ? 'Fund Your Wallet' : user?.kycStatus === 'verified' && user?.bvn ? 'Get Your Virtual Account' : 'Complete Your KYC'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.85 }}>
                {user?.virtual_account_number
                  ? 'Pay instantly via Lotus Bank card payment'
                  : user?.kycStatus === 'verified' && user?.bvn
                    ? 'Generate a dedicated bank account to receive transfers directly'
                    : 'Verify your identity to unlock funding options'}
              </p>
            </div>
          </div>
          <div className="card-body" style={{ padding: '30px', textAlign: 'center' }}>
            {user?.virtual_account_number ? (
              <button
                onClick={() => setIsModalOpen(true)}
                className="btn btn-primary"
                style={{ padding: '12px 30px', fontSize: '1rem', borderRadius: '6px' }}
              >
                💳 Deposit with Lotus Bank
              </button>
            ) : user?.kycStatus === 'verified' && user?.bvn ? (
              <div>
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
              </div>
            ) : (
              <div>
                <p style={{ color: '#64748b', marginBottom: '10px', fontSize: '0.95rem' }}>
                  Complete your KYC verification to unlock a dedicated virtual bank account.
                </p>
                <Link to="/dashboard/kyc" className="btn btn-secondary" style={{ padding: '12px 30px', fontSize: '1rem', borderRadius: '6px', textDecoration: 'none', display: 'inline-block' }}>
                  Complete KYC
                </Link>
              </div>
            )}
            {vaError && <p style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '10px' }}>{vaError}</p>}
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
      <DepositModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => window.location.reload()}
      />
    </>
  );
};

export default Wallet;
