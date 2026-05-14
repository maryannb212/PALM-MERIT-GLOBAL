import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { getMyTransactions, payTshirtFee } from '../../services/api';
import DepositModal from '../../components/DepositModal';

import './Dashboard.css';

const Wallet = () => {
  const { user, updateUser } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tshirtLoading, setTshirtLoading] = useState(false);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  const availableBalance = parseFloat(user?.available_balance || 0);
  const heldBalance = parseFloat(user?.held_balance || 0);
  const walletBalance = parseFloat(user?.wallet_balance || 0);

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
          <div className="virtual-account-balance">
            <span className="label">Wallet Balance</span>
            <span className="amount">{formatCurrency(walletBalance)}</span>
          </div>
        </div>

        {/* ─── Virtual Account Section ─── */}
        <div className="funding-account-section card mt-4">
          <div className="card-header">
            <h3>Virtual Account</h3>
            <span className="badge badge-success">Automated Funding</span>
          </div>
          <div className="funding-account-body">
            {user?.virtual_account_number ? (
              <div className="funding-account-details">
                <div className="funding-info-grid">
                  <div className="info-item">
                    <span className="label">Account Number</span>
                    <div className="value-with-copy">
                      <span className="value">{user.virtual_account_number}</span>
                      <button 
                        className="btn-copy" 
                        onClick={() => {
                          navigator.clipboard.writeText(user.virtual_account_number);
                          alert('Account number copied!');
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  <div className="info-item">
                    <span className="label">Bank Name</span>
                    <span className="value">{user.virtual_bank_name}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Account Name</span>
                    <span className="value">{user.virtual_account_name}</span>
                  </div>
                </div>
                <div className="funding-instructions">
                  <p><strong>Instructions:</strong> Transfer money directly to this account to fund your wallet instantly. All transfers are credited automatically.</p>
                </div>
              </div>
            ) : (
              <div className="funding-pending-state">
                <p>
                  {user?.kycStatus === 'verified' 
                    ? "We're setting up your virtual account. Please check back in a few minutes." 
                    : "Your virtual account will be generated once your KYC verification is approved."}
                </p>
                {user?.kycStatus !== 'verified' && user?.kycStatus !== 'pending' && (
                  <Link to="/dashboard/kyc" className="btn btn-primary mt-2">Complete KYC</Link>
                )}
              </div>
            )}
          </div>
          <div className="card-footer" style={{ borderTop: '1px solid #eee', padding: '15px' }}>
            <button className="btn btn-primary btn-block" onClick={() => setIsModalOpen(true)}>
              Other Funding Options (Paystack/Flutterwave)
            </button>
          </div>
        </div>

        {/* ─── T-Shirt Reminder Banner ─── */}
        {!user?.tshirt_paid && (
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
        <div className="stats-grid stats-grid-wallet">
          <div className="stat-card wallet-balance-card">
            <div className="stat-icon">💰</div>
            <h3>Available Balance</h3>
            <div className="stat-value">{formatCurrency(availableBalance)}</div>
          </div>
          <div className="stat-card credit-card" style={{ background: '#fff3cd' }}>
            <div className="stat-icon">🔒</div>
            <h3>Held Balance</h3>
            <div className="stat-value">{formatCurrency(heldBalance)}</div>
          </div>
          <div className="stat-card credit-card">
            <div className="stat-icon">📈</div>
            <h3>Total Credit</h3>
            <div className="stat-value">{formatCurrency(totalCredit)}</div>
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
