import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaMoneyBillWave, FaHistory, FaClock, FaCheckCircle, FaTimesCircle, FaChevronLeft } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { requestWithdrawal, getMyTransactions } from '../../services/api';

import './Dashboard.css';

const WithdrawPage = () => {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState([]);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  const [bankDetails, setBankDetails] = useState({
    accountName: user?.bankDetails?.accountName || '',
    accountNumber: user?.bankDetails?.accountNumber || '',
    bankName: user?.bankDetails?.bankName || ''
  });

  const fetchWithdrawals = async () => {
    try {
      const { data } = await getMyTransactions();
      setWithdrawals(data.filter(t => t.type === 'withdrawal'));
    } catch (err) {
      console.error('Failed to fetch withdrawals:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const handleWithdraw = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) < 500) {
      setMessage({ text: 'Minimum withdrawal is ₦500', type: 'error' });
      return;
    }
    if (parseFloat(amount) > parseFloat(user?.available_balance || 0)) {
      setMessage({ text: 'Insufficient available balance', type: 'error' });
      return;
    }
    if (!bankDetails.accountNumber || !bankDetails.bankName) {
      setMessage({ text: 'Please complete your bank details first.', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      await requestWithdrawal({ amount: parseFloat(amount), bankDetails });
      setMessage({ text: 'Withdrawal request submitted!', type: 'success' });
      setAmount('');
      fetchWithdrawals();
      refreshProfile();
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Failed to submit request.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(val);

  return (
    <>
        <header className="dashboard-header">
          <div className="header-title">
            <button className="btn-icon-only" onClick={() => navigate('/dashboard')}>
              <FaChevronLeft />
            </button>
            <h2>Withdraw Funds</h2>
          </div>
        </header>

        <div className="withdraw-grid">
          {/* Withdrawal Form */}
          <div className="withdraw-form-container card">
            <div className="card-header">
              <h3>New Request</h3>
              <div className="balance-badge">
                Available: {formatCurrency(user?.available_balance || 0)}
              </div>
            </div>
            
            <form onSubmit={handleWithdraw} className="p-4">
              <div className="form-group">
                <label>Amount to Withdraw (₦)</label>
                <input 
                  type="number" 
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)} 
                  placeholder="Minimum ₦500" 
                  required 
                />
              </div>

              <div className="bank-info-summary">
                <h4>Recipient Bank Account</h4>
                {bankDetails.accountNumber ? (
                  <div className="bank-details-box">
                    <p><strong>{bankDetails.accountName}</strong></p>
                    <p>{bankDetails.bankName} - {bankDetails.accountNumber}</p>
                    <button type="button" className="btn-link" onClick={() => navigate('/dashboard/bank-details')}>Change</button>
                  </div>
                ) : (
                  <div className="bank-details-box warning">
                    <p>No bank account linked.</p>
                    <button type="button" className="btn btn-sm btn-warning" onClick={() => navigate('/dashboard/bank-details')}>Add Bank Account</button>
                  </div>
                )}
              </div>

              {message.text && (
                <div className={`form-message ${message.type === 'success' ? 'success' : 'error'} mt-3`}>
                  {message.text}
                </div>
              )}

              <button type="button" className="btn btn-primary btn-block mt-4" disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} title="Withdrawals are currently disabled">
                Submit Withdrawal Request
              </button>
            </form>
          </div>

          {/* Withdrawal History */}
          <div className="withdraw-history-container card">
            <div className="card-header">
              <h3><FaHistory /> Recent Withdrawals</h3>
            </div>
            <div className="table-responsive">
              <table className="transaction-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    <tr><td colSpan="3" className="text-center p-4">Loading...</td></tr>
                  ) : withdrawals.length > 0 ? (
                    withdrawals.map(wd => (
                      <tr key={wd.id}>
                        <td>{new Date(wd.created_at).toLocaleDateString()}</td>
                        <td>{formatCurrency(wd.amount)}</td>
                        <td>
                          <span className={`status-badge ${wd.status}`}>
                            {wd.status === 'pending' && <FaClock />}
                            {wd.status === 'completed' && <FaCheckCircle />}
                            {wd.status === 'cancelled' && <FaTimesCircle />}
                            {wd.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="3" className="text-center p-4 text-muted">No withdrawal history found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
    </>
  );
};

export default WithdrawPage;
