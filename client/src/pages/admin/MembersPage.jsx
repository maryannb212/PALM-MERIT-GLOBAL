import React, { useState, useEffect } from 'react';
import { getAllUsers } from '../../services/api';
import { FaSearch, FaUsers, FaUserTag, FaCalendarAlt, FaEnvelope, FaPhone, FaShieldAlt, FaCircle } from 'react-icons/fa';
import '../dashboard/Dashboard.css';
import './Admin.css';

const MembersPage = () => {
  const [members, setMembers] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const avatarColors = ['#800020', '#D4AF37', '#1e293b', '#475569', '#64748b'];

  useEffect(() => {
    fetchMembers();
  }, []);

  useEffect(() => {
    const results = members.filter(member =>
      `${member.first_name} ${member.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.phone && member.phone.includes(searchTerm))
    );
    setFilteredMembers(results);
  }, [searchTerm, members]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const { data } = await getAllUsers();
      setMembers(data);
      setFilteredMembers(data);
      setError('');
    } catch (err) {
      setError('System was unable to synchronize member records. Please verify administrative credentials.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getAvatarColor = (id) => {
    const index = (id?.charCodeAt(0) || 0) % avatarColors.length;
    return avatarColors[index];
  };

  return (
    <div className="admin-page-content">
      <header className="dashboard-header">
        <div className="header-title">
          <div className="header-icon"><FaUsers /></div>
          <div>
            <h2>Community Directory</h2>
            <p className="text-muted">Total Active Members: <strong>{members.length}</strong></p>
          </div>
        </div>

        <div className="header-actions">
          <div className="search-box">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Filter by name, email or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="refined-input"
            />
          </div>
        </div>
      </header>

      {error && (
        <div className="notification-alert alert-error">
          <FaShieldAlt />
          <span>{error}</span>
          <button onClick={fetchMembers} className="btn-inline-retry">Reconnect</button>
        </div>
      )}

      <div className="admin-card table-card">
        {loading ? (
          <div className="table-loader">
            <div className="spinner-small"></div>
            <span>Synchronizing member database...</span>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="table-empty">
            <div className="empty-icon">👥</div>
            <h3>No Records Found</h3>
            <p>{searchTerm ? `Your search for "${searchTerm}" returned no matches.` : "The community directory is currently empty."}</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th><FaUserTag /> Member Identity</th>
                  <th>Contact Information</th>
                  <th>System Role</th>
                  <th>Membership</th>
                  <th>Identity Verification</th>
                  <th className="text-right"><FaCalendarAlt /> Access Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map(member => (
                  <tr key={member.id} className="table-row-hover">
                    <td>
                      <div className="member-cell">
                        <div
                          className="member-avatar"
                          style={{ background: getAvatarColor(member.id) }}
                        >
                          {(member.first_name?.[0] || 'U')}{(member.last_name?.[0] || '')}
                        </div>
                        <div className="member-info">
                          <span className="member-name">{member.first_name} {member.last_name}</span>
                          <span className="member-id">UUID: {member.id.substring(0, 8).toUpperCase()}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="contact-info">
                        <div className="contact-item"><FaEnvelope size={12} /> {member.email}</div>
                        <div className="contact-item"><FaPhone size={12} /> {member.phone || 'N/A'}</div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge-pill ${member.role === 'admin' ? 'pill-burgundy' : 'pill-dark'}`}>
                        {member.role.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div className="status-dot">
                        <FaCircle
                          size={10}
                          color={member.has_paid_membership ? '#10b981' : '#f59e0b'}
                        />
                        <span style={{ fontWeight: 600 }}>{member.has_paid_membership ? 'PREMIUM' : 'GUEST'}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge-status ${
                        member.kyc_status === 'verified' ? 'status-verified' :
                        member.kyc_status === 'pending' ? 'status-pending' : 'status-unverified'
                      }`}>
                        {member.kyc_status?.toUpperCase() || 'UNVERIFIED'}
                      </span>
                    </td>
                    <td className="text-right date-cell">
                      {new Date(member.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
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

export default MembersPage;
