import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

import { getPendingPayouts, approvePayout } from '../../services/api';
import { FaCheckCircle, FaExclamationCircle, FaHourglassHalf, FaMoneyBillWave, FaBoxOpen } from 'react-icons/fa';
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
    if (!window.confirm(`Are you sure you want to ${actionName} for this account?`)) return;

    const notes = window.prompt(`Add any notes for this ${type} settlement (optional):`);
    if (notes === null) return;

    setProcessingId(payoutId);
    try {
      await approvePayout({ payoutId, notes });
      alert(`${actionName} confirmed successfully!`);
      fetchPayouts();
    } catch (error) {
      alert(error.response?.data?.message || 'Action failed');
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
    <>
        <header className="dashboard-header">
          <div>
            <h2>Financial Settlement Center</h2>
            <p className="text-muted">Review matured accounts, verify clearance, and approve payouts.</p>
          </div>
        </header>

        <div className="subs-tabs admin-tabs">
          <div className={`subs-tab ${activeTab === 'matured' ? 'active' : ''}`} onClick={() => setActiveTab('matured')}>
            Matured / Awaiting Clearance <span className="tab-badge">{data.filter(i => ['matured', 'pending_clearance'].includes(i.plan_status)).length}</span>
          </div>
          <div className={`subs-tab ${activeTab === 'pending_settlement' ? 'active' : ''}`} onClick={() => setActiveTab('pending_settlement')}>
            Pending Settlement <span className="tab-badge">{data.filter(i => i.plan_status === 'pending_settlement').length}</span>
          </div>
          <div className={`subs-tab ${activeTab === 'settled' ? 'active' : ''}`} onClick={() => setActiveTab('settled')}>
            Settled History <span className="tab-badge">{data.filter(i => i.plan_status === 'settled').length}</span>
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', marginTop: '40px' }}>Loading payout data...</p>
        ) : filteredData.length === 0 ? (
          <div className="empty-subscriptions-state">
            <p>No records found in this category.</p>
          </div>
        ) : (
          <div className="table-responsive" style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #eee' }}>
            <table className="transaction-table admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Plan Details</th>
                  <th>Value</th>
                  <th>Status Info</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item) => (
                  <tr key={item.plan_id}>
                    <td>
                      <div style={{ fontWeight: 'bold' }}>{item.first_name} {item.last_name}</div>
                      <div className="text-muted" style={{ fontSize: '0.8rem' }}>{item.email}</div>
                      <div style={{ marginTop: '4px' }}>
                        {item.tshirt_paid ? 
                          <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>👕 T-Shirt Paid</span> : 
                          <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>👕 T-Shirt Unpaid</span>
                        }
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: '600', color: 'var(--color-primary-dark)' }}>{item.plan_name}</div>
                      <div className="text-muted" style={{ fontSize: '0.8rem' }}>Matured: {new Date(item.maturity_date).toLocaleDateString()}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{formatCurrency(item.amount)}</div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>Type: {item.payout_type.toUpperCase()}</div>
                    </td>
                    <td>
                      <div>
                        {item.plan_status === 'pending_clearance' && <span className="badge badge-warning">Awaiting ₦3,000 Fee</span>}
                        {item.plan_status === 'pending_settlement' && <span className="badge badge-info">Cleared & Ready</span>}
                        {item.plan_status === 'settled' && <span className="badge badge-success">Fully Paid</span>}
                        {item.plan_status === 'matured' && item.plan_name === 'GOLDEN_BASKET' && <span className="badge badge-info">Bypassed Clearance</span>}
                      </div>
                      {item.payout_date && (
                        <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                          Due: {new Date(item.payout_date).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td>
                      {item.plan_status === 'pending_settlement' && (
                        <button 
                          className="btn btn-sm btn-primary"
                          onClick={() => handleApprove(item.payout_id, item.payout_type)}
                          disabled={processingId === item.payout_id || !item.tshirt_paid}
                          title={!item.tshirt_paid ? "User must pay T-Shirt fee before payout" : ""}
                        >
                          {item.payout_type === 'cash' ? <FaMoneyBillWave /> : <FaBoxOpen />}
                          {processingId === item.payout_id ? ' Approving...' : (item.payout_type === 'cash' ? ' Settle Cash' : ' Release Goods')}
                        </button>
                      )}
                      {item.plan_status === 'settled' && (
                        <span style={{ color: '#16a34a', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <FaCheckCircle /> Settled
                        </span>
                      )}
                      {item.plan_status === 'pending_clearance' && (
                         <span style={{ color: '#856404', fontSize: '0.85rem' }}>
                           <FaHourglassHalf /> Waiting for User
                         </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </>
  );
};

export default AdminPayouts;
