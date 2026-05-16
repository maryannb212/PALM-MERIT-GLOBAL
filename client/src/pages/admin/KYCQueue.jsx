import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaCheck, FaTimes, FaEye, FaIdCard, FaUserShield, FaMapMarkerAlt, FaUniversity, FaCalendarDay } from 'react-icons/fa';
import { getPendingKYC, updateKYCStatus } from '../../services/api';
import '../dashboard/Dashboard.css';
import './Admin.css';

const KYCQueue = () => {
  const { admin } = useAuth();
  const navigate = useNavigate();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    if (!admin) navigate('/admin/login');
    fetchQueue();
  }, [admin]);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const { data } = await getPendingKYC();
      setQueue(data);
    } catch (err) {
      console.error('Error fetching KYC queue:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, status) => {
    if (!window.confirm(`Are you sure you want to ${status} this identity request?`)) return;

    setProcessingId(id);
    try {
      await updateKYCStatus(id, { status });
      setQueue(queue.filter(item => item.user_id !== id));
      setSelectedRequest(null);
    } catch (err) {
      alert('Failed to update KYC status. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="admin-page-content">
      <header className="dashboard-header">
        <div className="header-title">
          <div className="header-icon"><FaUserShield /></div>
          <div>
            <h2>KYC Verification Queue</h2>
            <p className="text-muted">Awaiting identity verification: {queue.length}</p>
          </div>
        </div>
      </header>

      <div className="admin-card table-card">
        {loading ? (
          <div className="table-loader">
            <div className="spinner-small"></div>
            <span>Loading verification requests...</span>
          </div>
        ) : queue.length === 0 ? (
          <div className="table-empty">
            <div className="empty-icon">🛡️</div>
            <h3>Queue is Clear</h3>
            <p>All submitted identity documents have been processed.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th><FaIdCard /> Applicant</th>
                  <th>ID Type</th>
                  <th>Submitted At</th>
                  <th className="text-right">Verification Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.map(req => (
                  <tr key={req.id} className="table-row-hover">
                    <td>
                      <div className="member-cell">
                        <div className="member-avatar">
                          {req.first_name?.[0]}{req.last_name?.[0]}
                        </div>
                        <div className="member-info">
                          <span className="member-name">{req.first_name} {req.last_name}</span>
                          <span className="member-id">BVN: {req.bvn || 'HIDDEN'}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge-pill pill-burgundy">{req.id_type?.replace('_', ' ')}</span>
                    </td>
                    <td className="date-cell">{new Date(req.submitted_at).toLocaleDateString()}</td>
                    <td className="text-right">
                      <div className="action-buttons">
                        <button className="btn-icon btn-view" onClick={() => setSelectedRequest(req)} title="Review Documents">
                          <FaEye />
                        </button>
                        <button
                          className="btn-icon btn-approve"
                          onClick={() => handleAction(req.user_id, 'verified')}
                          disabled={processingId === req.user_id}
                          title="Verify"
                        >
                          <FaCheck />
                        </button>
                        <button
                          className="btn-icon btn-reject"
                          onClick={() => handleAction(req.user_id, 'rejected')}
                          disabled={processingId === req.user_id}
                          title="Reject"
                        >
                          <FaTimes />
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

      {selectedRequest && (
        <div className="modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="modal-content kyc-details-modal" onClick={e => e.stopPropagation()}>
            <header className="modal-header">
              <div className="modal-header-title">
                <FaIdCard />
                <h3>Review Submission: {selectedRequest.first_name}</h3>
              </div>
              <button className="close-btn" onClick={() => setSelectedRequest(null)}>&times;</button>
            </header>

            <div className="kyc-modal-body">
              <div className="kyc-info-grid">
                <div className="kyc-info-item">
                  <label><FaUniversity /> Financial Profile</label>
                  <p><strong>Bank:</strong> {selectedRequest.bank_name}</p>
                  <p><strong>A/C:</strong> {selectedRequest.account_number}</p>
                  <p><strong>A/C Name:</strong> {selectedRequest.account_name}</p>
                </div>

                <div className="kyc-info-item">
                  <label><FaCalendarDay /> Personal Details</label>
                  <p><strong>Gender:</strong> {selectedRequest.gender}</p>
                  <p><strong>DOB:</strong> {selectedRequest.date_of_birth}</p>
                </div>

                <div className="kyc-info-item full">
                  <label><FaMapMarkerAlt /> Registered Address</label>
                  <p>{selectedRequest.address}</p>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-outline-danger"
                onClick={() => handleAction(selectedRequest.user_id, 'rejected')}
                disabled={processingId === selectedRequest.user_id}
              >
                Reject Submission
              </button>
              <button
                className="btn-primary"
                onClick={() => handleAction(selectedRequest.user_id, 'verified')}
                disabled={processingId === selectedRequest.user_id}
              >
                Approve & Verify Identity
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KYCQueue;
