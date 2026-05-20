import React, { useState, useEffect } from 'react';
import API from '../../services/api';
import { FaUserCheck, FaSpinner, FaTimes, FaCheck, FaExclamationTriangle } from 'react-icons/fa';
import './AdminDashboard.css'; // Reusing standard admin styles

const EligibilityQueue = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [approvedAmount, setApprovedAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const res = await API.get('/admin/eligibility-queue');
      setPlans(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch eligibility queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleApprove = async () => {
    if (!approvedAmount) {
      alert('Please enter an approved amount');
      return;
    }

    if (!window.confirm(`Approve payout of ₦${approvedAmount} for ${selectedPlan.first_name}?`)) return;

    try {
      setProcessing(true);
      await API.post('/admin/approve-eligibility', {
        planId: selectedPlan.id,
        approvedAmount: parseFloat(approvedAmount),
        notes
      });
      alert('Plan approved successfully.');
      setSelectedPlan(null);
      fetchQueue();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to approve plan.');
    } finally {
      setProcessing(false);
    }
  };

  const openModal = (plan) => {
    setSelectedPlan(plan);
    setApprovedAmount(plan.target_amount);
    setNotes('Approved by Admin');
  };

  if (loading) return <div style={{ padding: '20px' }}><FaSpinner className="fa-spin" /> Loading Queue...</div>;

  return (
    <div className="admin-page-container">
      <header className="admin-page-header">
        <h2>Eligibility Review Queue</h2>
        <p>Review matured savings plans and assign final payout bonuses.</p>
      </header>

      {error && <div className="alert alert-danger"><FaExclamationTriangle /> {error}</div>}

      <div className="admin-table-container">
        {plans.length === 0 ? (
          <p style={{ padding: '20px', textAlign: 'center', color: '#666' }}>No plans currently in review.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Plan Type</th>
                <th>Target Amount</th>
                <th>Maturity Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {plans.map(plan => (
                <tr key={plan.id}>
                  <td>
                    {plan.first_name} {plan.last_name}
                    <br/><small className="text-muted">{plan.email}</small>
                  </td>
                  <td>{plan.plan_name}</td>
                  <td>₦{parseFloat(plan.target_amount).toLocaleString()}</td>
                  <td>{new Date(plan.maturity_date).toLocaleDateString()}</td>
                  <td>
                    <button 
                      className="btn btn-sm btn-primary"
                      onClick={() => openModal(plan)}
                    >
                      <FaUserCheck /> Review & Approve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Review Modal */}
      {selectedPlan && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Approve Payout: {selectedPlan.plan_name}</h3>
              <button className="close-btn" onClick={() => setSelectedPlan(null)}><FaTimes /></button>
            </div>
            
            <div className="modal-body">
              <div style={{ marginBottom: '15px', background: '#f8fafc', padding: '15px', borderRadius: '8px' }}>
                <p><strong>User:</strong> {selectedPlan.first_name} {selectedPlan.last_name}</p>
                <p><strong>Base Target Amount:</strong> ₦{parseFloat(selectedPlan.target_amount).toLocaleString()}</p>
                <p>
                  <a href="/admin/referrals" target="_blank" rel="noreferrer" style={{ color: '#0ea5e9' }}>
                    View User's Referral Activity →
                  </a>
                </p>
              </div>

              <div className="form-group">
                <label>Final Approved Amount (₦)</label>
                <input 
                  type="number" 
                  className="form-control"
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(e.target.value)}
                />
                <small className="form-text text-muted">Enter the total payout amount including any referral bonuses.</small>
              </div>

              <div className="form-group mt-3">
                <label>Admin Notes</label>
                <textarea 
                  className="form-control"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows="3"
                ></textarea>
              </div>
            </div>

            <div className="modal-footer mt-4" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedPlan(null)}>Cancel</button>
              <button 
                className="btn btn-success" 
                onClick={handleApprove}
                disabled={processing}
              >
                {processing ? <FaSpinner className="fa-spin" /> : <><FaCheck /> Approve Payout</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EligibilityQueue;
