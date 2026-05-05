import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

import { FaCheck, FaTimes, FaEye } from 'react-icons/fa';
import { getPendingKYC, updateKYCStatus } from '../../services/api';
import '../dashboard/Dashboard.css';
import './Admin.css';

const KYCQueue = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);

  useEffect(() => {
    if (user?.role !== 'admin') navigate('/dashboard');
    fetchQueue();
  }, [user]);

  const fetchQueue = async () => {
    try {
      const { data } = await getPendingKYC();
      setQueue(data);
    } catch (err) {
      console.error('Error fetching KYC queue:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, status) => {
    if (!window.confirm(`Are you sure you want to ${status} this request?`)) return;
    try {
      await updateKYCStatus(id, { status });
      setQueue(queue.filter(item => item.id !== id));
      setSelectedRequest(null);
      alert(`KYC ${status} successful!`);
    } catch (err) {
      alert('Failed to update status.');
    }
  };

  return (
    <>
        <header className="dashboard-header">
          <h2>KYC Verification Queue</h2>
          <p>Review and verify user identity submissions.</p>
        </header>

        <div className="card">
          {loading ? (
            <p>Loading queue...</p>
          ) : queue.length === 0 ? (
            <div className="empty-state">
              <p>No pending KYC submissions found.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Document Type</th>
                    <th>Submitted At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map(req => (
                    <tr key={req.id}>
                      <td>
                        <strong>{req.first_name} {req.last_name}</strong>
                        <br /><small>{req.id_number}</small>
                      </td>
                      <td>{req.id_type}</td>
                      <td>{new Date(req.submitted_at).toLocaleDateString()}</td>
                      <td>
                        <button className="btn-icon btn-view" onClick={() => setSelectedRequest(req)} title="View Details">
                          <FaEye />
                        </button>
                        <button className="btn-icon btn-approve" onClick={() => handleAction(req.user_id, 'verified')} title="Approve">
                          <FaCheck />
                        </button>
                        <button className="btn-icon btn-reject" onClick={() => handleAction(req.user_id, 'rejected')} title="Reject">
                          <FaTimes />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedRequest && (
          <div className="modal-overlay">
            <div className="modal-content kyc-details-modal">
              <header className="modal-header">
                <h3>KYC Details: {selectedRequest.first_name}</h3>
                <button className="close-btn" onClick={() => setSelectedRequest(null)}>&times;</button>
              </header>
              <div className="kyc-details-grid">
                <div className="detail-item"><strong>BVN:</strong> {selectedRequest.bvn || 'N/A'}</div>
                <div className="detail-item"><strong>Bank:</strong> {selectedRequest.bank_name} ({selectedRequest.account_number})</div>
                <div className="detail-item"><strong>Gender:</strong> {selectedRequest.gender}</div>
                <div className="detail-item"><strong>DOB:</strong> {selectedRequest.date_of_birth}</div>
                <div className="detail-item full"><strong>Address:</strong> {selectedRequest.address}</div>
              </div>
              <div className="modal-actions">
                <button className="btn btn-danger" onClick={() => handleAction(selectedRequest.user_id, 'rejected')}>Reject</button>
                <button className="btn btn-success" onClick={() => handleAction(selectedRequest.user_id, 'verified')}>Approve & Verify User</button>
              </div>
            </div>
          </div>
        )}
    </>

  );
};

export default KYCQueue;
