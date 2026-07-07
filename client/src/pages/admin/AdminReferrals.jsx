import React, { useState, useEffect, useMemo } from 'react';
import { 
  FaSearch, FaUserFriends, 
  FaClock, FaUserCheck, FaChevronDown, FaChevronUp,
  FaLink, FaShieldAlt, FaChevronLeft, FaChevronRight,
  FaUsers
} from 'react-icons/fa';
import API from '../../services/api';
import './Admin.css';

const AdminReferrals = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [stats, setStats] = useState({ totalReferrals: 0, totalUnlocks: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterHasDownlines, setFilterHasDownlines] = useState(false);
  const [expandedUser, setExpandedUser] = useState(null);
  const [error, setError] = useState('');
  const [isArrayData, setIsArrayData] = useState(false);

  const fetchReferralStats = async (page = 1, hasDownlines = filterHasDownlines) => {
    try {
      setLoading(true);
      const res = await API.get(`/admin/referrals?page=${page}&limit=20${hasDownlines ? '&hasDownlines=true' : ''}`);
      const responseData = res.data;
      if (Array.isArray(responseData)) {
        setIsArrayData(true);
        setData(responseData);
        const totalPages = Math.max(1, Math.ceil(responseData.length / 20));
        setPagination({ page: 1, limit: 20, total: responseData.length, totalPages });
        const totalReferrals = responseData.reduce((sum, u) => sum + (u.downlinesCount || 0), 0);
        const totalUnlocks = responseData.filter(u => u.referralUnlockDate && new Date(u.referralUnlockDate) <= new Date()).length;
        setStats({ totalReferrals, totalUnlocks });
      } else {
        setIsArrayData(false);
        setData(responseData?.users || []);
        setPagination(responseData?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
        setStats(responseData?.stats || { totalReferrals: 0, totalUnlocks: 0 });
      }
      setError('');
    } catch (err) {
      console.error('Error fetching admin referrals:', err);
      setError('Failed to load administrative referral details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferralStats(1, false);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (isArrayData) setPagination(prev => ({ ...prev, page: 1 }));
  }, [searchTerm, isArrayData]);

  const filteredUsers = data.filter(user => {
    const nameMatch = `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (user.referralCode && user.referralCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
                      (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
                      (user.phone && user.phone.includes(searchTerm));
    return nameMatch;
  });

  const displayUsers = useMemo(() => {
    if (!isArrayData) return filteredUsers;
    const start = (pagination.page - 1) * pagination.limit;
    return filteredUsers.slice(start, start + pagination.limit);
  }, [filteredUsers, isArrayData, pagination.page, pagination.limit]);

  const toggleExpandUser = (userId) => {
    setExpandedUser(prev => prev === userId ? null : userId);
  };

  const toggleHasDownlines = () => {
    const next = !filterHasDownlines;
    setFilterHasDownlines(next);
    fetchReferralStats(1, next);
    setExpandedUser(null);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const goToPage = (page) => {
    if (page < 1 || page > pagination.totalPages) return;
    if (isArrayData) {
      setPagination(prev => ({ ...prev, page }));
    } else {
      fetchReferralStats(page);
    }
    setExpandedUser(null);
  };

  const renderPagination = () => {
    if (pagination.totalPages <= 1) return null;
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, pagination.page - Math.floor(maxVisible / 2));
    let end = Math.min(pagination.totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    pages.push(
      <button key="prev" className="btn btn-sm" style={{ margin: '0 2px' }}
        disabled={pagination.page === 1}
        onClick={() => goToPage(pagination.page - 1)}>
        <FaChevronLeft size={10} />
      </button>
    );
    if (start > 1) {
      pages.push(
        <button key={1} className="btn btn-sm" style={{ margin: '0 2px' }}
          onClick={() => goToPage(1)}>1</button>
      );
      if (start > 2) {
        pages.push(<span key="dots1" style={{ color: '#64748b', margin: '0 4px' }}>...</span>);
      }
    }
    for (let i = start; i <= end; i++) {
      pages.push(
        <button key={i} className={`btn btn-sm ${i === pagination.page ? 'btn-primary' : ''}`}
          style={{ margin: '0 2px', minWidth: '32px' }}
          onClick={() => goToPage(i)}>{i}</button>
      );
    }
    if (end < pagination.totalPages) {
      if (end < pagination.totalPages - 1) {
        pages.push(<span key="dots2" style={{ color: '#64748b', margin: '0 4px' }}>...</span>);
      }
      pages.push(
        <button key={pagination.totalPages} className="btn btn-sm" style={{ margin: '0 2px' }}
          onClick={() => goToPage(pagination.totalPages)}>{pagination.totalPages}</button>
      );
    }
    pages.push(
      <button key="next" className="btn btn-sm" style={{ margin: '0 2px' }}
        disabled={pagination.page === pagination.totalPages}
        onClick={() => goToPage(pagination.page + 1)}>
        <FaChevronRight size={10} />
      </button>
    );
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', padding: '16px 0', marginTop: '12px' }}>
        {pages}
        <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '12px' }}>
          Page {pagination.page} of {pagination.totalPages} ({pagination.total} users)
        </span>
      </div>
    );
  };

  return (
    <div className="admin-page-content">
      <header className="dashboard-header">
        <div className="header-title">
          <div className="header-icon"><FaUserFriends /></div>
          <div>
            <h2>Referral Oversight & Auditing</h2>
            <p className="text-muted">Monitor invitation chains and audit payout eligibility</p>
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
            className={`btn btn-sm ${filterHasDownlines ? 'btn-primary' : 'btn-secondary'}`}
            onClick={toggleHasDownlines}
            style={{ padding: '8px 14px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
          >
            <FaUsers size={12} style={{ marginRight: 6 }} />
            {filterHasDownlines ? 'Show All' : 'Has Downlines'}
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
            <button className="btn btn-primary" onClick={() => fetchReferralStats(1)} style={{ marginTop: 15 }}>
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
                <div className="stat-value">{stats.totalReferrals}</div>
                <p className="stat-label">Invited across all members</p>
              </div>
            </div>
            <div className="stat-card success">
              <div className="stat-icon-wrapper">
                <FaClock />
              </div>
              <div className="stat-info">
                <h3>Unlocked Links</h3>
                <div className="stat-value">{stats.totalUnlocks}</div>
                <p className="stat-label">Active referral codes</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                <FaUsers style={{ color: '#10b981' }} />
              </div>
              <div className="stat-info">
                <h3>With Downlines</h3>
                <div className="stat-value">{pagination.total}</div>
                <p className="stat-label">{filterHasDownlines ? 'Members with downlines' : 'Total members'}</p>
              </div>
            </div>
          </div>

          <div className="admin-card table-card">
            {displayUsers.length === 0 ? (
              <div className="table-empty">
                <div className="empty-icon"><FaUserFriends size={32} /></div>
                <h3>No Referral Data Found</h3>
                <p>{searchTerm ? 'Your search returned no matches.' : 'No referral records are available in the system yet.'}</p>
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
                    </tr>
                  </thead>
                  <tbody>
                    {displayUsers.map((user) => {
                      const isExpanded = expandedUser === user.id;
                      const isUnlocked = user.referralUnlockDate && new Date(user.referralUnlockDate) <= new Date();

                      return (
                        <React.Fragment key={user.id}>
                          <tr
                            className="table-row-hover"
                            onClick={() => toggleExpandUser(user.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td onClick={(e) => { e.stopPropagation(); toggleExpandUser(user.id); }}>
                              {isExpanded ? <FaChevronUp size={12} style={{ color: '#d4af37' }} /> : <FaChevronDown size={12} style={{ color: '#64748b' }} />}
                            </td>
                            <td>
                              <div className="member-cell">
                                <div
                                  className="member-avatar"
                                  style={{ background: '#800020', width: '32px', height: '32px', fontSize: '0.75rem' }}
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
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan="6" style={{ padding: '0', background: 'rgba(255, 255, 255, 0.03)' }}>
                                <div style={{ padding: '20px 25px' }}>
                                  <h4 style={{ color: '#d4af37', margin: '0 0 12px 0', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.03em' }}>
                                    Referred Downlines ({user.downlines.length})
                                  </h4>
                                  {user.downlines.length === 0 ? (
                                    <p style={{ color: '#64748b', textAlign: 'center', padding: '15px 0', margin: 0 }}>
                                      No downline members registered under this link.
                                    </p>
                                  ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                        <thead>
                                          <tr>
                                            <th style={{ padding: '10px 14px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Name</th>
                                            <th style={{ padding: '10px 14px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Email</th>
                                            <th style={{ padding: '10px 14px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Code</th>
                                            <th style={{ padding: '10px 14px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Date Used</th>
                                            <th style={{ padding: '10px 14px', textAlign: 'right', color: '#94a3b8', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Status</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {user.downlines.map((down, idx) => (
                                            <tr key={`${down.id}-${idx}`}>
                                              <td style={{ padding: '10px 14px', color: '#e2e8f0', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{down.firstName} {down.lastName}</td>
                                              <td style={{ padding: '10px 14px', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{down.email || 'N/A'}</td>
                                              <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                <code style={{ color: '#d4af37', fontFamily: 'monospace', fontWeight: 600, fontSize: '0.75rem' }}>{down.usedCode}</code>
                                              </td>
                                              <td style={{ padding: '10px 14px', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                {down.usedAt ? formatDate(down.usedAt) : 'N/A'}
                                              </td>
                                              <td style={{ padding: '10px 14px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
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
                {renderPagination()}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminReferrals;
