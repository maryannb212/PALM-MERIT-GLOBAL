import React, { useState, useEffect } from 'react';
import {
  getReconciliation,
  approveManualPayment,
  getPendingTransactions,
  getPendingWithdrawals,
  approveWithdrawal,
  rejectWithdrawal
} from '../../services/api';
import { FaBalanceScale, FaCheckCircle, FaHistory, FaFilter, FaEye, FaHandHoldingUsd, FaTimesCircle, FaChartLine, FaWallet, FaLock, FaUniversity } from 'react-icons/fa';
import '../dashboard/Dashboard.css';
import './Admin.css';

const ReconciliationPage = () => {
  const [stats, setStats] = useState({ transactions: [], liabilities: {} });
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, pendingRes, withdrawalsRes] = await Promise.all([
        getReconciliation(),
        getPendingTransactions(),
        getPendingWithdrawals()
      ]);
      setStats(statsRes.data);
      setPendingTransactions(pendingRes.data);
      setPendingWithdrawals(withdrawalsRes.data);
    } catch (error) {
      console.error('Error fetching reconciliation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm('Confirm manual verification of this payment?')) return;
    setProcessingId(id);
    try {
      await approveManualPayment(id);
      fetchData();
    } catch (error) {
      alert('Error approving payment');
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveWithdrawal = async (id) => {
    if (!window.confirm('Approve withdrawal request? This will deduct from the user balance.')) return;
    setProcessingId(id);
    try {
      await approveWithdrawal(id);
      fetchData();
    } catch (error) {
      alert('Error approving withdrawal');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectWithdrawal = async (id) => {
    const reason = window.prompt('Enter reason for rejection (required):');
    if (!reason) return;
    setProcessingId(id);
    try {
      await rejectWithdrawal(id, { reason });
      fetchData();
    } catch (error) {
      alert('Error rejecting withdrawal');
    } finally {
      setProcessingId(null);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount || 0);
  };

  return (
    <div className="admin-page-content">
      <header className="dashboard-header">
        <div className="header-title">
          <div className="header-icon"><FaBalanceScale /></div>
          <div>
            <h2>Financial Reconciliation</h2>
            <p className="text-muted">Monitor platform liquidity and manage pending settlements.</p>
          </div>
        </div>
      </header>

      <div className="admin-tabs-nav">
        <button
          className={`admin-tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          <FaChartLine /> Financial Summary
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          <FaCheckCircle /> Pending Deposits
          {pendingTransactions.length > 0 && <span className="count-badge primary">{pendingTransactions.length}</span>}
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'withdrawals' ? 'active' : ''}`}
          onClick={() => setActiveTab('withdrawals')}
        >
          <FaHandHoldingUsd /> Withdrawal Requests
          {pendingWithdrawals.length > 0 && <span className="count-badge danger">{pendingWithdrawals.length}</span>}
        </button>
      </div>

      <div className="admin-card table-card">
        {loading ? (
          <div className="table-loader">
            <div className="spinner-small"></div>
            <span>Synchronizing financial data...</span>
          </div>
        ) : activeTab === 'summary' ? (
          <div className="summary-view p-4">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon-wrapper"><FaWallet /></div>
                <div className="stat-info">
                  <h3>Total Liabilities</h3>
                  <div className="stat-value">{formatCurrency(stats.liabilities?.total)}</div>
                  <p className="stat-label">Member Capital</p>
                </div>
              </div>
              <div className="stat-card success">
                <div className="stat-icon-wrapper"><FaCheckCircle /></div>
                <div className="stat-info">
                  <h3>Available Liquidity</h3>
                  <div className="stat-value">{formatCurrency(stats.liabilities?.available)}</div>
                  <p className="stat-label text-success">Withdrawable Balance</p>
                </div>
              </div>
              <div className="stat-card warning">
                <div className="stat-icon-wrapper"><FaLock /></div>
                <div className="stat-info">
                  <h3>Held Capital</h3>
                  <div className="stat-value">{formatCurrency(stats.liabilities?.held)}</div>
                  <p className="stat-label text-warning">Reserved for Withdrawals</p>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <h3>Volume Analytics</h3>
              <div className="table-responsive mt-3">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Transaction Category</th>
                      <th>Operational Status</th>
                      <th>Request Count</th>
                      <th>Cumulative Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.transactions?.map((stat, i) => (
                      <tr key={i} className="table-row-hover">
                        <td><strong>{stat.type.toUpperCase()}</strong></td>
                        <td>
                          <span className={`badge-status ${stat.status === 'completed' ? 'status-verified' : (stat.status === 'pending' ? 'status-pending' : 'status-unverified')}`}>
                            {stat.status.toUpperCase()}
                          </span>
                        </td>
                        <td>{stat.count}</td>
                        <td className="value-amount">{formatCurrency(stat.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === 'pending' ? (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User Details</th>
                  <th>Payment Type</th>
                  <th>Net Amount</th>
                  <th>Submission Date</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingTransactions.length === 0 ? (
                  <tr><td colSpan="5" className="table-empty">No pending deposits found.</td></tr>
                ) : (
                  pendingTransactions.map((tx) => (
                    <tr key={tx.id} className="table-row-hover">
                      <td>
                        <div className="member-cell">
                          <div className="member-avatar">{tx.first_name?.[0]}</div>
                          <div className="member-info">
                            <span className="member-name">{tx.first_name} {tx.last_name}</span>
                            <span className="member-id">{tx.email}</span>
                          </div>
                        </div>
                      </td>
                      <td><span className="badge-pill pill-burgundy">{tx.type.toUpperCase()}</span></td>
                      <td><div className="value-amount">{formatCurrency(tx.amount)}</div></td>
                      <td className="date-cell">{new Date(tx.created_at).toLocaleDateString()}</td>
                      <td className="text-right">
                        <div className="action-buttons">
                          {tx.receipt_url && (
                            <button className="btn-icon btn-view" onClick={() => window.open(`${window.location.origin.replace('3000', '5000')}${tx.receipt_url}`, '_blank')}>
                              <FaEye />
                            </button>
                          )}
                          <button className="btn-primary btn-sm" onClick={() => handleApprove(tx.id)} disabled={processingId === tx.id}>
                            Approve
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Amount</th>
                  <th>Destination Account</th>
                  <th>Request Date</th>
                  <th className="text-right">Management</th>
                </tr>
              </thead>
              <tbody>
                {pendingWithdrawals.length === 0 ? (
                  <tr><td colSpan="5" className="table-empty">No pending withdrawals found.</td></tr>
                ) : (
                  pendingWithdrawals.map((w) => (
                    <tr key={w.id} className="table-row-hover">
                      <td>
                        <div className="member-cell">
                          <div className="member-avatar">{w.first_name?.[0]}</div>
                          <div className="member-info">
                            <span className="member-name">{w.first_name} {w.last_name}</span>
                            <span className="member-id">{w.email}</span>
                          </div>
                        </div>
                      </td>
                      <td><div className="value-amount danger">{formatCurrency(w.amount)}</div></td>
                      <td>
                        <div className="bank-pill">
                          <FaUniversity /> {w.bank_name} <br/>
                          <strong>{w.account_number}</strong>
                        </div>
                      </td>
                      <td className="date-cell">{new Date(w.created_at).toLocaleDateString()}</td>
                      <td className="text-right">
                        <div className="action-buttons">
                          <button className="btn-icon btn-approve" onClick={() => handleApproveWithdrawal(w.id)} disabled={processingId === w.id}>
                            <FaCheckCircle />
                          </button>
                          <button className="btn-icon btn-reject" onClick={() => handleRejectWithdrawal(w.id)} disabled={processingId === w.id}>
                            <FaTimesCircle />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReconciliationPage;
