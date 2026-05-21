import React, { useState, useEffect } from 'react';
import { broadcastNotification, getAllUsers } from '../../services/api';
import { FaBullhorn, FaPaperPlane, FaUserSecret, FaRegBell, FaInfoCircle, FaShieldAlt, FaUsers, FaUser, FaSearch, FaCheckCircle } from 'react-icons/fa';
import '../dashboard/Dashboard.css';
import './Admin.css';

const BroadcastPage = () => {
  const [formData, setFormData] = useState({
    userId: '',
    title: '',
    message: '',
    type: 'SYSTEM'
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [targetMode, setTargetMode] = useState('all'); // 'all' or 'specific'
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (targetMode === 'specific' && users.length === 0) {
      setLoadingUsers(true);
      getAllUsers()
        .then(res => setUsers(res.data || []))
        .catch(err => console.error('Failed to load users:', err))
        .finally(() => setLoadingUsers(false));
    }
  }, [targetMode]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setFormData({ ...formData, userId: user.id });
    setUserSearch('');
  };

  const handleClearUser = () => {
    setSelectedUser(null);
    setFormData({ ...formData, userId: '' });
  };

  const filteredUsers = userSearch.length >= 2
    ? users.filter(u =>
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.email && u.email.toLowerCase().includes(userSearch.toLowerCase())) ||
        (u.phone && u.phone.includes(userSearch))
      ).slice(0, 8)
    : [];

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (targetMode === 'specific' && !formData.userId) {
      setStatus({ type: 'error', msg: 'Please select a user to send the notification to.' });
      return;
    }

    const targetLabel = targetMode === 'all' ? 'ALL users' : `${selectedUser?.first_name} ${selectedUser?.last_name}`;
    if (!window.confirm(`Send this broadcast to ${targetLabel}?`)) return;

    setLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      const payload = {
        title: formData.title,
        message: formData.message,
        type: formData.type,
        userId: targetMode === 'specific' ? formData.userId : ''
      };
      await broadcastNotification(payload);
      setStatus({ type: 'success', msg: `Broadcast successfully sent to ${targetLabel}.` });
      setFormData({ userId: '', title: '', message: '', type: 'SYSTEM' });
      setSelectedUser(null);
      setTargetMode('all');
    } catch (error) {
      console.error('Broadcast error:', error);
      setStatus({ type: 'error', msg: error.response?.data?.message || 'Communication failed. Please check network connectivity.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-page-content">
      <header className="dashboard-header">
        <div className="header-title">
          <div className="header-icon"><FaBullhorn /></div>
          <div>
            <h2>Broadcast System</h2>
            <p className="text-muted">Send messages to all members or target a specific user directly.</p>
          </div>
        </div>
      </header>

      <div className="admin-grid-single">
        <div className="admin-card form-card">
          <div className="card-header-styled">
            <FaRegBell />
            <span>Create New Announcement</span>
          </div>

          <form onSubmit={handleSubmit} className="admin-refined-form">
            {/* Target Audience Toggle */}
            <div className="form-group">
              <label className="field-label">Target Audience</label>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setTargetMode('all'); setSelectedUser(null); setFormData({ ...formData, userId: '' }); }}
                  style={{
                    flex: 1, padding: '14px 16px', borderRadius: '10px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    fontWeight: targetMode === 'all' ? 'bold' : 'normal',
                    background: targetMode === 'all' ? 'linear-gradient(135deg, #800020, #a30029)' : '#f8fafc',
                    color: targetMode === 'all' ? '#fff' : '#475569',
                    border: targetMode === 'all' ? '2px solid #800020' : '1px solid #cbd5e1',
                    fontSize: '0.95rem', transition: 'all 0.2s ease'
                  }}
                >
                  <FaUsers /> All Users
                </button>
                <button
                  type="button"
                  onClick={() => setTargetMode('specific')}
                  style={{
                    flex: 1, padding: '14px 16px', borderRadius: '10px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    fontWeight: targetMode === 'specific' ? 'bold' : 'normal',
                    background: targetMode === 'specific' ? 'linear-gradient(135deg, #800020, #a30029)' : '#f8fafc',
                    color: targetMode === 'specific' ? '#fff' : '#475569',
                    border: targetMode === 'specific' ? '2px solid #800020' : '1px solid #cbd5e1',
                    fontSize: '0.95rem', transition: 'all 0.2s ease'
                  }}
                >
                  <FaUser /> Specific User
                </button>
              </div>

              {/* User search for specific targeting */}
              {targetMode === 'specific' && (
                <div style={{ position: 'relative' }}>
                  {selectedUser ? (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 16px', borderRadius: '10px',
                      background: '#ecfdf5', border: '1px solid #a7f3d0'
                    }}>
                      <FaCheckCircle style={{ color: '#059669' }} />
                      <div style={{ flex: 1 }}>
                        <strong style={{ color: '#065f46' }}>{selectedUser.first_name} {selectedUser.last_name}</strong>
                        <span style={{ marginLeft: '10px', fontSize: '0.85rem', color: '#64748b' }}>{selectedUser.email || selectedUser.phone}</span>
                      </div>
                      <button type="button" onClick={handleClearUser} style={{
                        background: '#fee2e2', border: 'none', color: '#dc2626', borderRadius: '6px',
                        padding: '6px 12px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold'
                      }}>
                        Change
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="input-wrapper">
                        <FaSearch className="input-icon" />
                        <input
                          type="text"
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          placeholder="Search by name, email, or phone..."
                          className="refined-input"
                          autoFocus
                        />
                      </div>
                      {loadingUsers && <small style={{ color: '#64748b' }}>Loading users...</small>}

                      {filteredUsers.length > 0 && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                          background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.1)', maxHeight: '250px', overflowY: 'auto',
                          marginTop: '4px'
                        }}>
                          {filteredUsers.map(u => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => handleSelectUser(u)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                                padding: '12px 16px', border: 'none', borderBottom: '1px solid #f1f5f9',
                                background: 'transparent', cursor: 'pointer', textAlign: 'left',
                                transition: 'background 0.15s ease'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <div style={{
                                width: '32px', height: '32px', borderRadius: '50%',
                                background: 'rgba(128,0,32,0.1)', color: 'var(--color-primary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.85rem', fontWeight: 'bold', flexShrink: 0
                              }}>
                                {(u.first_name || '?')[0]}
                              </div>
                              <div>
                                <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.9rem' }}>
                                  {u.first_name} {u.last_name}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                  {u.email || u.phone || 'No contact info'}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {userSearch.length >= 2 && filteredUsers.length === 0 && !loadingUsers && (
                        <small style={{ color: '#94a3b8', display: 'block', marginTop: '6px' }}>No users found matching "{userSearch}"</small>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="form-row-split">
              <div className="form-group">
                <label className="field-label">Notification Priority/Type</label>
                <div className="input-wrapper">
                  <FaShieldAlt className="input-icon" />
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    className="refined-select"
                  >
                    <option value="SYSTEM">📢 System Update</option>
                    <option value="PAYMENT">💳 Payment Reminder</option>
                    <option value="PROMO">✨ Program Promotion</option>
                    <option value="ALERT">⚠️ Critical Alert</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="field-label">Announcement Heading</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                placeholder="Brief summary of the message..."
                className="refined-input full-width"
              />
            </div>

            <div className="form-group">
              <label className="field-label">Message Content</label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                required
                rows="6"
                placeholder="Type your detailed message here. Be clear and professional..."
                className="refined-textarea"
              ></textarea>
            </div>

            {status.msg && (
              <div className={`notification-alert ${status.type === 'success' ? 'alert-success' : 'alert-error'}`}>
                {status.type === 'success' ? <FaCheckCircle /> : <FaInfoCircle />}
                <span>{status.msg}</span>
              </div>
            )}

            <div className="form-actions">
              <button type="submit" className="btn-primary btn-large" disabled={loading}>
                {loading ? (
                  <span className="spinner-inline"></span>
                ) : (
                  <><FaPaperPlane /> {targetMode === 'all' ? 'Broadcast to All Users' : 'Send to User'}</>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="admin-side-help">
          <h3>Communication Guidelines</h3>
          <div className="help-item">
            <span className="bullet"></span>
            <p>Ensure message titles are concise and informative.</p>
          </div>
          <div className="help-item">
            <span className="bullet"></span>
            <p>Use "Critical Alert" only for maintenance or security issues.</p>
          </div>
          <div className="help-item">
            <span className="bullet"></span>
            <p><strong>All Users:</strong> Broadcasts are sent to every registered member instantly.</p>
          </div>
          <div className="help-item">
            <span className="bullet"></span>
            <p><strong>Specific User:</strong> Search by name or email to target a single user directly.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BroadcastPage;
