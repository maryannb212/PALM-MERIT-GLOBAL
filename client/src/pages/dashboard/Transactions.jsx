import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getMyTransactions } from '../../services/api';
import DepositModal from '../../components/DepositModal';

import './Dashboard.css';

const Transactions = () => {
  const { user, refreshProfile } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  const walletBalance = parseFloat(user?.walletBalance || user?.wallet_balance || 0);

  const totalCredit = transactions
    .filter(t => t.type === 'deposit' && t.status === 'completed')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const totalDebit = transactions
    .filter(t => (t.type === 'withdrawal' || t.type === 'subscription') && t.status === 'completed')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const filteredTransactions = transactions.filter(tx => 
    (tx.plan_name && tx.plan_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    tx.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
        <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Transaction History</h2>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            Fund Wallet
          </button>
        </header>

        {/* ─── Stats Row ─── */}
        <div className="stats-grid stats-grid-wallet">
          <div className="stat-card wallet-balance-card">
            <div className="stat-icon">💰</div>
            <h3>Wallet Balance</h3>
            <div className="stat-value">{formatCurrency(walletBalance)}</div>
          </div>
          <div className="stat-card credit-card">
            <div className="stat-icon">📈</div>
            <h3>Total Credit</h3>
            <div className="stat-value">{formatCurrency(totalCredit)}</div>
          </div>
          <div className="stat-card debit-card">
            <div className="stat-icon">📉</div>
            <h3>Total Debit</h3>
            <div className="stat-value">{formatCurrency(totalDebit)}</div>
          </div>
        </div>

        {/* ─── Transaction History Section ─── */}
        <div className="transaction-history-section">
          <h3>Transaction History</h3>
          
          <div className="table-controls" style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div className="filters" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <select className="control-select">
                <option>All time</option>
              </select>
              <select className="control-select">
                <option>All Transactions</option>
              </select>
            </div>
            <div className="search-box" style={{ flex: '1 1 250px', minWidth: '200px' }}>
              <input 
                type="text" 
                placeholder="Search transactions..." 
                className="control-input" 
                style={{ width: '100%', boxSizing: 'border-box' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
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
                ) : filteredTransactions.length > 0 ? (
                  filteredTransactions.map((tx) => (
                    <tr key={tx.id}>
                      <td>{tx.plan_name ? `Subscription: ${tx.plan_name}` : (tx.type.charAt(0).toUpperCase() + tx.type.slice(1))}</td>
                      <td>{new Date(tx.created_at).toLocaleDateString()}</td>
                      <td>{formatCurrency(tx.amount)}</td>
                      <td>
                        <span className={`badge ${tx.type === 'deposit' ? 'badge-success' : 'badge-warning'}`} style={{ color: tx.type === 'deposit' ? '#155724' : '#856404', background: tx.type === 'deposit' ? '#d4edda' : '#fff3cd' }}>
                          {tx.type}
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={{
                          background: tx.status === 'completed' ? '#d4edda' : (tx.status === 'failed' ? '#f8d7da' : '#e2e3e5'),
                          color: tx.status === 'completed' ? '#155724' : (tx.status === 'failed' ? '#721c24' : '#383d41')
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

export default Transactions;
