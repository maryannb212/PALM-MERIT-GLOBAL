import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getPendingPayouts, approvePayout } from '../../services/api';
import { FaCheckCircle, FaExclamationCircle, FaHourglassHalf, FaMoneyBillWave, FaBoxOpen, FaHandHoldingHeart, FaUser, FaTshirt, FaCalendarCheck } from 'react-icons/fa';
import '../dashboard/Dashboard.css';
import './Admin.css';

const AdminPayouts = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending_settlement');
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/dashboard');
    } else {
      fetchPayouts();
    }
  }, [user]);

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      const response = await getPendingPayouts();
      setData(response.data || []);
    } catch (error) {
      console.error('Error fetching payouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (payoutId, type) => {
    const actionName = type === 'cash' ? 'Settle Cash' : 'Release Goods';
    if (!window.confirm(`Are you sure you want to confirm ${actionName}?`)) return;

    const notes = window.prompt(`Enter settlement notes/reference (optional):`);
    if (notes === null) return;

    setProcessingId(payoutId);
    try {
      await approvePayout({ payoutId, notes });
      fetchPayouts();
    } catch (error) {
      alert(error.response?.data?.message || 'Settlement failed');
    } finally {
      setProcessingId(null);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  const filteredData = data.filter(item => {
    if (activeTab === 'matured') return item.plan_status === 'matured' || item.plan_status === 'pending_clearance';
    if (activeTab === 'pending_settlement') return item.plan_status === 'pending_settlement';
    if (activeTab === 'settled') return item.plan_status === 'settled';
    return true;
  });

  return (
    <div className="admin-page-content">
      <header className="dashboard-header">
        <div className="header-title">
          <div className="header-icon"><FaHandHoldingHeart /></div>
          <div>
            <h2>Financial Settlement Center</h2>
            <p className="text-muted">Review matured accounts, verify clearance, and approve payouts.</p>
          </div>
        </div>
      </header>

      <div className="admin-tabs-nav">
        <button
          className={`admin-tab-btn ${activeTab === 'matured' ? 'active' : ''}`}
          onClick={() => setActiveTab('matured')}
        >
          Awaiting Clearance
          <span className="count-badge">{data.filter(i => ['matured', 'pending_clearance'].includes(i.plan_status)).length}</span>
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'pending_settlement' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending_settlement')}
        >
          Ready for Payout
          <span className="count-badge primary">{data.filter(i => i.plan_status === 'pending_settlement').length}</span>
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'settled' ? 'active' : ''}`}
          onClick={() => setActiveTab('settled')}
        >
          Settlement History
        </button>
      </div>

      <div className="admin-card table-card">
        {loading ? (
          <div className="table-loader">
            <div className="spinner-small"></div>
            <span>Fetching financial records...</span>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="table-empty">
            <div className="empty-icon">💸</div>
            <h3>No Records Found</h3>
            <p>There are no payouts currently in this category.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th><FaUser /> Member Details</th>
                  <th>Plan Info</th>
                  <th>Maturity Value</th>
                  <th>Status & Logistics</th>
                  <th className="text-right">Settlement Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item) => (
                  <tr key={item.plan_id} className="table-row-hover">
                    <td>
                      <div className="member-cell">
                        <div className="member-avatar">
                          {item.first_name?.[0]}{item.last_name?.[0]}
                        </div>
                        <div className="member-info">
                          <span className="member-name">{item.first_name} {item.last_name}</span>
                          <span className="member-id">{item.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="plan-brief">
                        <div className="plan-name-small">{item.plan_name?.replace('_', ' ')}</div>
                        <div className="date-sub"><FaCalendarCheck size={10} /> {new Date(item.maturity_date).toLocaleDateString()}</div>
                      </div>
                    </td>
                    <td>
                      <div className="value-amount">{formatCurrency(item.amount)}</div>
                      <div className={`payout-type-tag ${item.payout_type}`}>{item.payout_type.toUpperCase()}</div>
                    </td>
                    <td>
                      <div className="logistics-info">
                        <div className="logistics-item">
                           {item.tshirt_paid ?
                             <span className="text-success"><FaTshirt /> T-Shirt Paid</span> :
                             <span className="text-danger"><FaTshirt /> T-Shirt Unpaid</span>
                           }
                        </div>
                        <div className="status-pill-box">
                          {item.plan_status === 'pending_clearance' && <span className="badge-status status-pending">Clearance Required</span>}
                          {item.plan_status === 'pending_settlement' && <span className="badge-status status-verified">Cleared</span>}
                          {item.plan_status === 'settled' && <span className="pill-dark">Settled</span>}
                        </div>
                      </div>
                    </td>
                    <td className="text-right">
                      {item.plan_status === 'pending_settlement' && (
                        <button
                          className="btn-primary btn-sm"
                          onClick={() => handleApprove(item.payout_id, item.payout_type)}
                          disabled={processingId === item.payout_id || !item.tshirt_paid}
                        >
                          {item.payout_type === 'cash' ? <FaMoneyBillWave /> : <FaBoxOpen />}
                          {processingId === item.payout_id ? ' Settling...' : ` Settle ${item.payout_type}`}
                        </button>
                      )}
                      {item.plan_status === 'settled' && (
                        <span className="settled-indicator">
                          <FaCheckCircle /> Verified
                        </span>
                      )}
                      {item.plan_status === 'pending_clearance' && (
                         <span className="waiting-indicator">
                           <FaHourglassHalf /> Awaiting Fee
                         </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPayouts;
