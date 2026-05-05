import React, { useState, useEffect } from 'react';
import { getAllUsers } from '../../services/api';

import './Admin.css';

const MembersPage = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const { data } = await getAllUsers();
      setMembers(data);
    } catch (err) {
      setError('Failed to load members.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <>
        <header className="dashboard-header">
          <h2>Member Management</h2>
          <p className="text-muted">View and manage all registered users.</p>
        </header>

        <div className="card">
          {error && <div className="alert alert-danger">{error}</div>}
          
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Membership</th>
                  <th>KYC Status</th>
                  <th>Joined Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" className="text-center">Loading members...</td></tr>
                ) : members.length === 0 ? (
                  <tr><td colSpan="7" className="text-center">No members found.</td></tr>
                ) : (
                  members.map(member => (
                    <tr key={member.id}>
                      <td>{member.first_name} {member.last_name}</td>
                      <td>{member.email}</td>
                      <td>{member.phone || 'N/A'}</td>
                      <td>
                        <span className={`badge ${member.role === 'admin' ? 'badge-primary' : 'badge-secondary'}`}>
                          {member.role}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${member.has_paid_membership ? 'badge-success' : 'badge-warning'}`}>
                          {member.has_paid_membership ? 'Paid' : 'Unpaid'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${member.kyc_status === 'verified' ? 'success' : member.kyc_status === 'pending' ? 'info' : 'warning'}`}>
                          {member.kyc_status}
                        </span>
                      </td>
                      <td>{formatDate(member.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
    </>
  );
};

export default MembersPage;
