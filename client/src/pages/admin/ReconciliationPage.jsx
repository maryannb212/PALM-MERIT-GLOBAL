import React, { useState, useEffect } from 'react';

import { 
  getReconciliation, 
  approveManualPayment, 
  getPendingTransactions,
  getPendingWithdrawals,
  approveWithdrawal,
  rejectWithdrawal
} from '../../services/api';
import { FaBalanceScale, FaCheckCircle, FaHistory, FaFilter, FaEye, FaHandHoldingUsd, FaTimesCircle } from 'react-icons/fa';
import '../dashboard/Dashboard.css';
import './Admin.css';

const ReconciliationPage = () => {
  const [stats, setStats] = useState({ transactions: [], liabilities: {} });
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');

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
    if (window.confirm('Are you sure you want to manually approve this payment?')) {
      try {
        await approveManualPayment(id);
        alert('Payment approved successfully');
        fetchData();
      } catch (error) {
        alert('Error approving payment');
      }
    }
  };

  const handleApproveWithdrawal = async (id) => {
    if (window.confirm('Approve this withdrawal? This will finalize the debit.')) {
      try {
        await approveWithdrawal(id);
        alert('Withdrawal approved');
        fetchData();
      } catch (error) {
        alert('Error approving withdrawal');
      }
    }
  };

  const handleRejectWithdrawal = async (id) => {
    const reason = window.prompt('Enter reason for rejection:');
    if (reason !== null) {
      try {
        await rejectWithdrawal(id, { reason });
        alert('Withdrawal rejected');
        fetchData();
      } catch (error) {
        alert('Error rejecting withdrawal');
      }
    }
  };

  return (
    <>
        <header className="dashboard-header">
          <div>
            <h2>Financial Reconciliation</h2>
            <p className="text-muted">Analyze platform liquidity and manage pending settlements.</p>
          </div>
        </header>

        <div className="tabs-container">
          <button 
            className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            <FaBalanceScale /> Financial Summary
          </button>
          <button 
            className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            <FaCheckCircle /> Pending Payments {pendingTransactions.length > 0 && <span className="notification-badge">{pendingTransactions.length}</span>}
          </button>
          <button 
            className={`tab-btn ${activeTab === 'withdrawals' ? 'active' : ''}`}
            onClick={() => setActiveTab('withdrawals')}
          >
            <FaHandHoldingUsd /> Pending Withdrawals {pendingWithdrawals.length > 0 && <span className="notification-badge warning">{pendingWithdrawals.length}</span>}
          </button>
        </div>

        {activeTab === 'summary' && (
          <div className="dashboard-section">
            <div className="reconciliation-grid">
              {loading ? (
                <p>Loading summary...</p>
              ) : (
                <>
                  {/* Platform Liabilities Summary */}
                  <div className="stats-grid" style={{ marginBottom: '30px' }}>
                    <div className="stat-card" style={{ borderLeft: '4px solid #007bff' }}>
                      <h3>Total Liabilities</h3>
                      <div className="stat-value">₦{parseFloat(stats.liabilities?.total || 0).toLocaleString()}</div>
                      <p className="text-muted small">Combined user balances</p>
                    </div>
                    <div className="stat-card" style={{ borderLeft: '4px solid #28a745' }}>
                      <h3>Available Liquid</h3>
                      <div className="stat-value">₦{parseFloat(stats.liabilities?.available || 0).toLocaleString()}</div>
                      <p className="text-muted small">Immediately withdrawable</p>
                    </div>
                    <div className="stat-card" style={{ borderLeft: '4px solid #ffc107' }}>
                      <h3>Held (Pending Approval)</h3>
                      <div className="stat-value">₦{parseFloat(stats.liabilities?.held || 0).toLocaleString()}</div>
                      <p className="text-muted small">Locked in pending withdrawals</p>
                    </div>
                  </div>

                  <h3>Transaction Volume by Type</h3>
                  <div className="table-responsive">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Transaction Type</th>
                          <th>Status</th>
                          <th>Count</th>
                          <th>Total Volume</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.transactions?.map((stat, i) => (
                          <tr key={i}>
                            <td><strong>{stat.type.toUpperCase()}</strong></td>
                            <td>
                              <span className={`badge badge-${stat.status === 'completed' ? 'success' : (stat.status === 'pending' ? 'warning' : 'danger')}`}>
                                {stat.status.toUpperCase()}
                              </span>
                            </td>
                            <td>{stat.count}</td>
                            <td>₦{parseFloat(stat.total_amount).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'pending' && (
          <div className="dashboard-section">
            <h3>Manual Payment Approvals</h3>
            <div className="reconciliation-grid">
              {loading ? (
                <p>Loading pending transactions...</p>
              ) : pendingTransactions.length === 0 ? (
                <p>No pending transactions found.</p>
              ) : (
                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Date</th>
                        <th>Receipt</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingTransactions.map((tx) => (
                        <tr key={tx.id}>
                          <td>
                            <div>
                              <div><strong>{tx.first_name} {tx.last_name}</strong></div>
                              <small className="text-muted">{tx.email}</small>
                            </div>
                          </td>
                          <td><span className="badge badge-info">{tx.type.toUpperCase()}</span></td>
                          <td>₦{parseFloat(tx.amount).toLocaleString()}</td>
                          <td>{new Date(tx.created_at).toLocaleDateString()}</td>
                          <td>
                            {tx.receipt_url ? (
                              <a 
                                href={`${window.location.origin.replace('3000', '5000')}${tx.receipt_url}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="btn-icon"
                                title="View Receipt"
                              >
                                <FaEye /> View
                              </a>
                            ) : (
                              <span className="text-muted">No Receipt</span>
                            )}
                          </td>
                          <td>
                            <button 
                              className="btn btn-primary btn-sm"
                              onClick={() => handleApprove(tx.id)}
                            >
                              Approve
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'withdrawals' && (
          <div className="dashboard-section">
            <h3>Pending Withdrawals</h3>
            <div className="reconciliation-grid">
              {loading ? (
                <p>Loading pending withdrawals...</p>
              ) : pendingWithdrawals.length === 0 ? (
                <p>No pending withdrawals found.</p>
              ) : (
                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Amount</th>
                        <th>Bank Details</th>
                        <th>Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingWithdrawals.map((w) => (
                        <tr key={w.id}>
                          <td>
                            <div>
                              <div><strong>{w.first_name} {w.last_name}</strong></div>
                              <small className="text-muted">{w.email}</small>
                            </div>
                          </td>
                          <td><strong>₦{parseFloat(w.amount).toLocaleString()}</strong></td>
                          <td>
                            <div className="small">
                              <div>{w.bank_name}</div>
                              <div>{w.account_number}</div>
                              <div className="text-muted">{w.account_name}</div>
                            </div>
                          </td>
                          <td>{new Date(w.created_at).toLocaleDateString()}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '5px' }}>
                              <button 
                                className="btn btn-success btn-sm"
                                onClick={() => handleApproveWithdrawal(w.id)}
                                title="Approve"
                              >
                                <FaCheckCircle />
                              </button>
                              <button 
                                className="btn btn-danger btn-sm"
                                onClick={() => handleRejectWithdrawal(w.id)}
                                title="Reject"
                              >
                                <FaTimesCircle />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
    </>
  );
};

export default ReconciliationPage;
