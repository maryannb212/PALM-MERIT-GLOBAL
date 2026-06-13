import React, { useState, useEffect } from 'react';
import { getAllUsers, updateKYCStatus, updateAdminUser, deleteAdminUser } from '../../services/api';
import { FaSearch, FaUsers, FaUserTag, FaCalendarAlt, FaEnvelope, FaPhone, FaShieldAlt, FaCircle, FaCheckCircle, FaEdit, FaTrashAlt, FaEye, FaExclamationTriangle } from 'react-icons/fa';
import EditMemberModal from './EditMemberModal';
import MemberDetailsModal from './MemberDetailsModal';
import UserDefaultsModal from './UserDefaultsModal';
import '../dashboard/Dashboard.css';
import './Admin.css';

const MembersPage = () => {
  const [members, setMembers] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingMember, setEditingMember] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDetailsUserId, setSelectedDetailsUserId] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [defaultsUserId, setDefaultsUserId] = useState(null);
  const [defaultsUserName, setDefaultsUserName] = useState('');
  const [isDefaultsModalOpen, setIsDefaultsModalOpen] = useState(false);

  const avatarColors = ['#800020', '#D4AF37', '#1e293b', '#475569', '#64748b'];

  useEffect(() => {
    fetchMembers();
  }, []);

  useEffect(() => {
    const results = members.filter(member =>
      `${member.first_name || ''} ${member.last_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.email && member.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
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

  const handleVerify = async (userId) => {
    if (!window.confirm('Force verify this user? This will instantly approve their KYC.')) return;
    try {
      await updateKYCStatus(userId, { status: 'verified' });
      fetchMembers();
      alert('User successfully verified.');
    } catch (err) {
      alert(err.response?.data?.message || 'Verification failed');
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('CRITICAL: Are you sure you want to permanently delete this user and all their data? This cannot be undone.')) return;
    try {
      await deleteAdminUser(userId);
      fetchMembers();
      alert('User successfully deleted.');
    } catch (err) {
      alert(err.response?.data?.message || 'Deletion failed');
    }
  };

  const handleEditSave = async (userId, data) => {
    try {
      await updateAdminUser(userId, data);
      setIsEditModalOpen(false);
      setEditingMember(null);
      fetchMembers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update user');
    }
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
                  <th>Defaults</th>
                  <th className="text-right"><FaCalendarAlt /> Access Date</th>
                  <th className="text-right">Actions</th>
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
                          <span className="member-name">{member.first_name || 'Unknown'} {member.last_name || ''}</span>
                          <span className="member-id">UUID: {member.id.substring(0, 8).toUpperCase()}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="contact-info">
                        <div className="contact-item"><FaEnvelope size={12} /> {member.email || 'No email'}</div>
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
                    <td>
                      {member.default_count > 0 ? (
                        <div className="status-dot" style={{ cursor: 'pointer' }}
                          onClick={() => { setDefaultsUserId(member.id); setDefaultsUserName(`${member.first_name || 'Unknown'} ${member.last_name || ''}`); setIsDefaultsModalOpen(true); }}>
                          <FaExclamationTriangle size={12} color="#dc2626" />
                          <span style={{ fontWeight: 600, color: '#dc2626', textDecoration: 'underline', textDecorationColor: '#dc2626' }}>
                            {member.default_count} Default{member.default_count > 1 ? 's' : ''}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: '#991b1b', marginLeft: 4 }}>
                            (₦{Number(member.outstanding_default).toLocaleString()})
                          </span>
                        </div>
                      ) : (
                        <div className="status-dot">
                          <FaCircle size={10} color="#10b981" />
                          <span style={{ fontWeight: 600 }}>CLEAN</span>
                        </div>
                      )}
                    </td>
                    <td className="text-right date-cell">
                      {new Date(member.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="text-right">
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {member.kyc_status !== 'verified' && (
                          <button 
                            onClick={() => handleVerify(member.id)} 
                            className="btn btn-sm btn-primary"
                            title="Force Verify KYC"
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                          >
                            <FaCheckCircle />
                          </button>
                        )}
                        <button 
                          onClick={() => { setSelectedDetailsUserId(member.id); setIsDetailsModalOpen(true); }}
                          className="btn btn-sm"
                          title="View Details"
                          style={{ padding: '4px 8px', fontSize: '12px', background: 'rgba(212, 175, 55, 0.1)', color: '#d4af37', border: '1px solid rgba(212, 175, 55, 0.3)' }}
                        >
                          <FaEye />
                        </button>
                        <button 
                          onClick={() => { setEditingMember(member); setIsEditModalOpen(true); }}
                          className="btn btn-sm btn-secondary"
                          title="Edit User"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                        >
                          <FaEdit />
                        </button>
                        <button 
                          onClick={() => handleDelete(member.id)}
                          className="btn btn-sm"
                          title="Delete User"
                          style={{ padding: '4px 8px', fontSize: '12px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #f87171' }}
                        >
                          <FaTrashAlt />
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
      
      <EditMemberModal 
        isOpen={isEditModalOpen} 
        onClose={() => { setIsEditModalOpen(false); setEditingMember(null); }}
        member={editingMember}
        onSave={handleEditSave}
      />
      
      <MemberDetailsModal 
        isOpen={isDetailsModalOpen}
        onClose={() => { setIsDetailsModalOpen(false); setSelectedDetailsUserId(null); }}
        userId={selectedDetailsUserId}
      />
      <UserDefaultsModal
        isOpen={isDefaultsModalOpen}
        onClose={() => { setIsDefaultsModalOpen(false); setDefaultsUserId(null); }}
        userId={defaultsUserId}
        userName={defaultsUserName}
      />
    </div>
  );
};

export default MembersPage;
