import React, { useState, useEffect } from 'react';
import {
  getReconciliation,
  approveManualPayment,
  getPendingTransactions,
  getPendingWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  getWebhookLogs,
  getRecentTransfers
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
  const [webhookLogs, setWebhookLogs] = useState([]);
  const [recentTransfers, setRecentTransfers] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, pendingRes, withdrawalsRes, logsRes, recentRes] = await Promise.all([
        getReconciliation(),
        getPendingTransactions(),
        getPendingWithdrawals(),
        getWebhookLogs(),
        getRecentTransfers()
      ]);
      setStats(statsRes.data);
      setPendingTransactions(pendingRes.data);
      setPendingWithdrawals(withdrawalsRes.data);
      setWebhookLogs(logsRes.data || []);
      setRecentTransfers(recentRes.data || []);
    } catch (error) {
      console.error('Error fetching reconciliation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (tx) => {
    const inputAmount = window.prompt(
      `Confirm manual verification of this payment?\n\nEnter the confirmed amount to credit the user (NGN):`,
      tx.amount || 0
    );
    
    if (inputAmount === null) return; // Admin cancelled
    
    const amount = parseFloat(inputAmount);
    if (isNaN(amount) || amount < 0) {
      alert("Invalid amount entered.");
      return;
    }

    setProcessingId(tx.id);
    try {
      await approveManualPayment(tx.id, { amount });
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
      <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', marginBottom: '25px' }}>
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
        <button
          className={`admin-tab-btn ${activeTab === 'webhook-logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('webhook-logs')}
        >
          <FaHistory /> Webhook Audit Logs
          {webhookLogs.length > 0 && <span className="count-badge primary" style={{ background: '#64748b' }}>{webhookLogs.length}</span>}
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'recent' ? 'active' : ''}`}
          onClick={() => setActiveTab('recent')}
        >
          <FaUniversity /> Recent Transfers (24h)
          {recentTransfers.length > 0 && <span className="count-badge primary" style={{ background: '#0ea5e9' }}>{recentTransfers.length}</span>}
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
                            <button className="btn-icon btn-view" onClick={() => {
                              const url = tx.receipt_url.startsWith('http') 
                                ? tx.receipt_url 
                                : `${import.meta.env.VITE_API_URL?.replace('/api', '') || window.location.origin.replace('3000', '5000')}${tx.receipt_url}`;
                              window.open(url, '_blank');
                            }}>
                              <FaEye />
                            </button>
                          )}
                          <button className="btn-primary btn-sm" onClick={() => handleApprove(tx)} disabled={processingId === tx.id}>
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
        ) : activeTab === 'withdrawals' ? (
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
        ) : activeTab === 'webhook-logs' ? (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Log ID</th>
                  <th>Gateway</th>
                  <th>Reference / Event</th>
                  <th>Processing Status</th>
                  <th>Activity Log Notes</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {webhookLogs.length === 0 ? (
                  <tr><td colSpan="6" className="table-empty">No webhook logs recorded yet.</td></tr>
                ) : (
                  webhookLogs.map((log) => (
                    <tr key={log.id} className="table-row-hover">
                      <td><code>#{log.id}</code></td>
                      <td>
                        <span className={`badge-pill ${log.source === 'lotus' ? 'pill-burgundy' : 'pill-dark'}`}>{log.source.toUpperCase()}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>{log.reference || 'N/A'}</span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{log.event_type}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge-status ${log.status === 'processed' ? 'status-verified' : log.status === 'duplicate' ? 'status-pending' : 'status-unverified'}`}>{log.status.toUpperCase()}</span>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: '#334155', maxWidth: '300px', wordBreak: 'break-all' }}>{log.note || 'No notes.'}</td>
                      <td className="date-cell" style={{ fontSize: '0.8rem' }}>{new Date(log.created_at).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'recent' ? (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Gateway</th>
                  <th>Wallet Balance</th>
                  <th>Reference</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentTransfers.length === 0 ? (
                  <tr><td colSpan="8" className="table-empty">No completed transactions in the last 24 hours.</td></tr>
                ) : (
                  recentTransfers.map((tx) => (
                    <tr key={tx.id} className="table-row-hover">
                      <td style={{ fontWeight: '600' }}>{tx.first_name} {tx.last_name}</td>
                      <td style={{ fontSize: '0.85rem' }}>{tx.email}</td>
                      <td>
                        <span className={`badge-pill ${tx.type === 'wallet_topup' ? 'pill-burgundy' : tx.type === 'membership' ? 'pill-dark' : tx.type === 'clearance' ? 'pill-warning' : 'pill-success'}`}>
                          {tx.type.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontWeight: '700', color: '#15803d' }}>{formatCurrency(tx.amount)}</td>
                      <td>
                        <span className="badge-pill pill-dark">{(tx.payment_provider || 'N/A').toUpperCase()}</span>
                      </td>
                      <td>{formatCurrency(tx.wallet_balance)}</td>
                      <td style={{ fontSize: '0.8rem', maxWidth: '200px', wordBreak: 'break-all' }}>
                        <code>{tx.reference}</code>
                      </td>
                      <td className="date-cell" style={{ fontSize: '0.8rem' }}>
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}

      </div>
    </div>
  );
};

export default ReconciliationPage;
