import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  FaSearch, FaExclamationTriangle, FaUserFriends, 
  FaClock, FaUserCheck, FaTimes, FaChevronDown, FaChevronUp,
  FaLink, FaShieldAlt
} from 'react-icons/fa';
import './Admin.css';

const AdminReferrals = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSuspicious, setFilterSuspicious] = useState(false);
  const [expandedUser, setExpandedUser] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchReferralStats = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/admin/referrals`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(res.data);
        setError('');
      } catch (err) {
        console.error('Error fetching admin referrals:', err);
        setError('Failed to load administrative referral details.');
      } finally {
        setLoading(false);
      }
    };
    fetchReferralStats();
  }, []);

  const filteredUsers = data.filter(user => {
    const nameMatch = `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (user.referralCode && user.referralCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
                      (user.phone && user.phone.includes(searchTerm));
    const suspiciousMatch = filterSuspicious ? user.isSuspicious : true;
    return nameMatch && suspiciousMatch;
  });

  const toggleExpandUser = (userId) => {
    setExpandedUser(prev => prev === userId ? null : userId);
  };

  const totalUnlocks = data.filter(u => u.referralUnlockDate && new Date(u.referralUnlockDate) <= new Date()).length;
  const totalSuspicious = data.filter(u => u.isSuspicious).length;
  const totalReferrals = data.reduce((sum, u) => sum + u.downlinesCount, 0);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  return (
    <div className="admin-page-content">
      <header className="dashboard-header">
        <div className="header-title">
          <div className="header-icon"><FaUserFriends /></div>
          <div>
            <h2>Referral Oversight & Auditing</h2>
            <p className="text-muted">Monitor invitation chains, prevent self-referral abuse, and audit payout eligibility</p>
          </div>
        </div>

        <div className="header-actions">
          <div className="search-box">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search by name, referral code, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="refined-input"
            />
          </div>
          <button
            className={`btn btn-sm ${filterSuspicious ? 'btn-danger' : 'btn-secondary'}`}
            onClick={() => setFilterSuspicious(!filterSuspicious)}
            style={{ padding: '8px 14px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
          >
            <FaExclamationTriangle size={12} style={{ marginRight: 6 }} />
            {filterSuspicious ? 'Show All' : 'Suspicious Only'}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="admin-card table-card" style={{ padding: '60px 0', textAlign: 'center' }}>
          <div className="table-loader">
            <div className="spinner-small"></div>
            <span>Analyzing referral networks...</span>
          </div>
        </div>
      ) : error ? (
        <div className="admin-card table-card" style={{ padding: '60px 0', textAlign: 'center' }}>
          <div className="table-empty">
            <FaShieldAlt size={40} style={{ color: '#ef4444' }} />
            <h3>Failed to Load Referral Data</h3>
            <p style={{ maxWidth: 400, margin: '0 auto' }}>{error}</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()} style={{ marginTop: 15 }}>
              Retry
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 25 }}>
            <div className="stat-card">
              <div className="stat-icon-wrapper" style={{ background: 'rgba(212, 175, 55, 0.1)' }}>
                <FaUserFriends style={{ color: '#d4af37' }} />
              </div>
              <div className="stat-info">
                <h3>Total Downlines</h3>
                <div className="stat-value">{totalReferrals}</div>
                <p className="stat-label">Invited across all members</p>
              </div>
            </div>
            <div className="stat-card success">
              <div className="stat-icon-wrapper">
                <FaClock />
              </div>
              <div className="stat-info">
                <h3>Unlocked Links</h3>
                <div className="stat-value">{totalUnlocks}</div>
                <p className="stat-label">Active referral codes</p>
              </div>
            </div>
            <div className="stat-card" style={{ borderColor: totalSuspicious > 0 ? '#dc2626' : undefined }}>
              <div className="stat-icon-wrapper" style={{ background: totalSuspicious > 0 ? 'rgba(220, 38, 38, 0.1)' : undefined }}>
                <FaExclamationTriangle style={{ color: totalSuspicious > 0 ? '#dc2626' : '#64748b' }} />
              </div>
              <div className="stat-info">
                <h3>Suspicious Flags</h3>
                <div className="stat-value" style={{ color: totalSuspicious > 0 ? '#dc2626' : 'white' }}>{totalSuspicious}</div>
                <p className="stat-label">Self-referral alerts</p>
              </div>
            </div>
          </div>

          <div className="admin-card table-card">
            {filteredUsers.length === 0 ? (
              <div className="table-empty">
                <div className="empty-icon"><FaUserFriends size={32} /></div>
                <h3>No Referral Data Found</h3>
                <p>{searchTerm || filterSuspicious ? 'Your search returned no matches.' : 'No referral records are available in the system yet.'}</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: '36px' }}></th>
                      <th>Member</th>
                      <th><FaLink size={11} /> Referral Code</th>
                      <th>Unlock Date</th>
                      <th className="text-right">Invites</th>
                      <th className="text-right">Qualified (≥2)</th>
                      <th className="text-right">Anti-Abuse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => {
                      const isExpanded = expandedUser === user.id;
                      const isUnlocked = user.referralUnlockDate && new Date(user.referralUnlockDate) <= new Date();

                      return (
                        <React.Fragment key={user.id}>
                          <tr
                            className="table-row-hover"
                            onClick={() => toggleExpandUser(user.id)}
                            style={{ cursor: 'pointer', background: user.isSuspicious ? 'rgba(220, 38, 38, 0.05)' : undefined }}
                          >
                            <td onClick={(e) => { e.stopPropagation(); toggleExpandUser(user.id); }}>
                              {isExpanded ? <FaChevronUp size={12} style={{ color: '#d4af37' }} /> : <FaChevronDown size={12} style={{ color: '#64748b' }} />}
                            </td>
                            <td>
                              <div className="member-cell">
                                <div
                                  className="member-avatar"
                                  style={{ background: user.isSuspicious ? '#dc2626' : '#800020', width: '32px', height: '32px', fontSize: '0.75rem' }}
                                >
                                  {(user.firstName?.[0] || 'U')}{(user.lastName?.[0] || '')}
                                </div>
                                <div className="member-info">
                                  <span className="member-name">{user.firstName || 'Unknown'} {user.lastName || ''}</span>
                                  <span className="member-id">{user.phone} | {user.email || 'No email'}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <code style={{ color: '#d4af37', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem' }}>
                                {user.referralCode || 'N/A'}
                              </code>
                            </td>
                            <td>
                              {isUnlocked ? (
                                <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.85rem' }}>Active</span>
                              ) : (
                                <span style={{ color: '#f59e0b', fontSize: '0.8rem' }}>
                                  {user.referralUnlockDate ? formatDate(user.referralUnlockDate) : 'N/A'}
                                </span>
                              )}
                            </td>
                            <td className="text-right" style={{ fontWeight: 700, fontSize: '1rem', color: '#d4af37' }}>
                              {user.downlinesCount}
                            </td>
                            <td className="text-right">
                              {user.isEligible ? (
                                <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.85rem' }}>
                                  <FaUserCheck size={12} style={{ marginRight: 4 }} /> Eligible (x2)
                                </span>
                              ) : (
                                <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Standard (x1)</span>
                              )}
                            </td>
                            <td className="text-right">
                              {user.isSuspicious ? (
                                <span style={{ color: '#dc2626', fontWeight: 600, fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                  title="Duplicate bank details detected with downlines">
                                  <FaExclamationTriangle /> Self-Referral
                                </span>
                              ) : (
                                <span style={{ color: '#10b981', fontSize: '0.8rem' }}>Clean</span>
                              )}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan="7" style={{ padding: '0', background: 'rgba(255, 255, 255, 0.02)' }}>
                                <div style={{ padding: '20px 30px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                  <h4 style={{ color: '#d4af37', margin: '0 0 15px 0', fontSize: '0.9rem', fontWeight: 700 }}>
                                    Referred Downlines ({user.downlines.length})
                                  </h4>
                                  {user.downlines.length === 0 ? (
                                    <p style={{ color: '#64748b', textAlign: 'center', padding: '15px 0', margin: 0 }}>
                                      No downline members registered under this link.
                                    </p>
                                  ) : (
                                    <div className="table-responsive">
                                      <table className="admin-table" style={{ fontSize: '0.8rem' }}>
                                        <thead>
                                          <tr>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th className="text-right">Status</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {user.downlines.map((down) => (
                                            <tr key={down.id} style={{ background: 'rgba(255,255,255,0.01)' }}>
                                              <td style={{ color: 'white', fontWeight: 600 }}>{down.firstName} {down.lastName}</td>
                                              <td style={{ color: '#94a3b8' }}>{down.email || 'N/A'}</td>
                                              <td className="text-right">
                                                {down.referralStatus === 'qualified' && (
                                                  <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 600 }}>Qualified savings downline</span>
                                                )}
                                                {down.referralStatus === 'disqualified' && (
                                                  <span style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 600 }}>Disqualified</span>
                                                )}
                                                {down.referralStatus === 'pending' && (
                                                  <span style={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: 600 }}>Plan initiated, pending deposits</span>
                                                )}
                                                {down.referralStatus === 'inactive' && (
                                                  <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>Inactive (No plans)</span>
                                                )}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminReferrals;
