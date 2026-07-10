import React, { useState, useEffect, useMemo } from 'react';
import { 
  FaSearch, FaUserFriends, 
  FaClock, FaChevronDown, FaChevronUp,
  FaLink, FaShieldAlt, FaChevronLeft, FaChevronRight,
  FaUsers, FaKey, FaCheckCircle, FaTimesCircle, FaLock, FaEye
} from 'react-icons/fa';
import API from '../../services/api';
import './Admin.css';
import '../../components/DepositModal.css';

const AdminReferrals = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [stats, setStats] = useState({ totalReferrals: 0, totalUnlocks: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterHasDownlines, setFilterHasDownlines] = useState(false);
  const [expandedUser, setExpandedUser] = useState(null);
  const [error, setError] = useState('');
  const [codesModalUser, setCodesModalUser] = useState(null);

  const fetchReferralStats = async (page = 1, hasDownlines = filterHasDownlines) => {
    try {
      setLoading(true);
      const res = await API.get(`/admin/referrals?page=${page}&limit=20${hasDownlines ? '&hasDownlines=true' : ''}`);
      const responseData = res.data;
      setData(responseData?.users || []);
      setPagination(responseData?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
      setStats(responseData?.stats || { totalReferrals: 0, totalUnlocks: 0 });
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
  }, []);

  const filteredUsers = data.filter(user => {
    const term = searchTerm.toLowerCase();
    return `${user.firstName} ${user.lastName}`.toLowerCase().includes(term) ||
           (user.referralCode && user.referralCode.toLowerCase().includes(term)) ||
           (user.email && user.email.toLowerCase().includes(term)) ||
           (user.phone && user.phone.includes(searchTerm));
  });

  const displayUsers = useMemo(() => {
    const start = (pagination.page - 1) * pagination.limit;
    return filteredUsers.slice(start, start + pagination.limit);
  }, [filteredUsers, pagination.page, pagination.limit]);

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
    const d = new Date(dateStr);
    if (isNaN(d)) return 'N/A';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d)) return 'N/A';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const goToPage = (page) => {
    if (page < 1 || page > pagination.totalPages) return;
    setPagination(prev => ({ ...prev, page }));
    setExpandedUser(null);
  };

  const renderPagination = () => {
    if (pagination.totalPages <= 1) return null;
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, pagination.page - Math.floor(maxVisible / 2));
    let end = Math.min(pagination.totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);

    pages.push(
      <button key="prev" className="btn btn-sm" style={{ margin: '0 2px' }}
        disabled={pagination.page === 1} onClick={() => goToPage(pagination.page - 1)}>
        <FaChevronLeft size={10} />
      </button>
    );
    if (start > 1) {
      pages.push(<button key={1} className="btn btn-sm" style={{ margin: '0 2px' }} onClick={() => goToPage(1)}>1</button>);
      if (start > 2) pages.push(<span key="dots1" style={{ color: '#64748b', margin: '0 4px' }}>...</span>);
    }
    for (let i = start; i <= end; i++) {
      pages.push(
        <button key={i} className={`btn btn-sm ${i === pagination.page ? 'btn-primary' : ''}`}
          style={{ margin: '0 2px', minWidth: '32px' }} onClick={() => goToPage(i)}>{i}</button>
      );
    }
    if (end < pagination.totalPages) {
      if (end < pagination.totalPages - 1) pages.push(<span key="dots2" style={{ color: '#64748b', margin: '0 4px' }}>...</span>);
      pages.push(<button key={pagination.totalPages} className="btn btn-sm" style={{ margin: '0 2px' }} onClick={() => goToPage(pagination.totalPages)}>{pagination.totalPages}</button>);
    }
    pages.push(
      <button key="next" className="btn btn-sm" style={{ margin: '0 2px' }}
        disabled={pagination.page === pagination.totalPages} onClick={() => goToPage(pagination.page + 1)}>
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

  const statusBadge = (status) => {
    const styles = {
      available: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', icon: <FaCheckCircle size={10} />, label: 'Active' },
      locked: { bg: '#fffbeb', color: '#d97706', border: '#fde68a', icon: <FaLock size={10} />, label: 'Locked' },
      used: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', icon: <FaTimesCircle size={10} />, label: 'Used' },
    };
    const s = styles[status] || styles.available;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px',
        borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
        background: s.bg, color: s.color, border: `1px solid ${s.border}`
      }}>
        {s.icon} {s.label}
      </span>
    );
  };

  const statusLabel = (status) => {
    const labels = {
      qualified: { text: 'Qualified', color: '#16a34a', bg: '#f0fdf4' },
      pending: { text: 'Pending', color: '#d97706', bg: '#fffbeb' },
      inactive: { text: 'Inactive', color: '#64748b', bg: '#f8fafc' },
      disqualified: { text: 'Disqualified', color: '#dc2626', bg: '#fef2f2' },
    };
    const l = labels[status] || labels.inactive;
    return (
      <span style={{
        padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
        background: l.bg, color: l.color
      }}>
        {l.text}
      </span>
    );
  };

  return (
    <div className="admin-page-content">
      <header className="dashboard-header">
        <div className="header-title">
          <div className="header-icon"><FaUserFriends /></div>
          <div>
            <h2>Referral Oversight</h2>
            <p className="text-muted">Monitor referral codes, downlines and audit payout eligibility</p>
          </div>
        </div>
        <div className="header-actions">
          <div className="search-box">
            <FaSearch className="search-icon" />
            <input type="text" placeholder="Search by name, code, or phone..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)} className="refined-input" />
          </div>
          <button className={`btn btn-sm ${filterHasDownlines ? 'btn-primary' : 'btn-secondary'}`}
            onClick={toggleHasDownlines} style={{ padding: '8px 14px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
            <FaUsers size={12} style={{ marginRight: 6 }} />
            {filterHasDownlines ? 'Show All' : 'Has Downlines'}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="admin-card table-card" style={{ padding: '60px 0', textAlign: 'center' }}>
          <div className="table-loader"><div className="spinner-small"></div><span>Loading referral data...</span></div>
        </div>
      ) : error ? (
        <div className="admin-card table-card" style={{ padding: '60px 0', textAlign: 'center' }}>
          <div className="table-empty">
            <FaShieldAlt size={40} style={{ color: '#ef4444' }} />
            <h3>Failed to Load</h3>
            <p style={{ maxWidth: 400, margin: '0 auto' }}>{error}</p>
            <button className="btn btn-primary" onClick={() => fetchReferralStats(1)} style={{ marginTop: 15 }}>Retry</button>
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
                <p className="stat-label">Code usages across all members</p>
              </div>
            </div>
            <div className="stat-card success">
              <div className="stat-icon-wrapper"><FaClock /></div>
              <div className="stat-info">
                <h3>Unlocked Links</h3>
                <div className="stat-value">{stats.totalUnlocks}</div>
                <p className="stat-label">Members with active codes</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                <FaUsers style={{ color: '#10b981' }} />
              </div>
              <div className="stat-info">
                <h3>{filterHasDownlines ? 'With Downlines' : 'Total Members'}</h3>
                <div className="stat-value">{pagination.total}</div>
                <p className="stat-label">{filterHasDownlines ? 'Members who have referred' : 'All registered members'}</p>
              </div>
            </div>
          </div>

          <div className="admin-card table-card">
            {displayUsers.length === 0 ? (
              <div className="table-empty">
                <div className="empty-icon"><FaUserFriends size={32} /></div>
                <h3>No Data Found</h3>
                <p>{searchTerm ? 'No matches for your search.' : 'No referral records available.'}</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: '36px' }}></th>
                      <th>Member</th>
                      <th><FaLink size={11} /> Referral Code</th>
                      <th>Status</th>
                      <th className="text-right">Downlines</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayUsers.map((user) => {
                      const isExpanded = expandedUser === user.id;
                      const isUnlocked = user.referralUnlockDate && new Date(user.referralUnlockDate) <= new Date();

                      return (
                        <React.Fragment key={user.id}>
                          <tr className="table-row-hover" style={{ cursor: 'pointer' }} onClick={() => toggleExpandUser(user.id)}>
                            <td onClick={(e) => { e.stopPropagation(); toggleExpandUser(user.id); }}>
                              {isExpanded ? <FaChevronUp size={12} style={{ color: '#d4af37' }} /> : <FaChevronDown size={12} style={{ color: '#64748b' }} />}
                            </td>
                            <td>
                              <div className="member-cell">
                                <div className="member-avatar" style={{ background: '#800020', width: '32px', height: '32px', fontSize: '0.75rem' }}>
                                  {(user.firstName?.[0] || 'U')}{(user.lastName?.[0] || '')}
                                </div>
                                <div className="member-info">
                                  <span className="member-name">{user.firstName} {user.lastName}</span>
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
                            <td className="text-right" onClick={(e) => e.stopPropagation()}>
                              <button className="btn btn-sm" onClick={() => setCodesModalUser(user)}
                                style={{ padding: '5px 12px', fontSize: '0.75rem', background: '#800020', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <FaKey size={10} /> Codes
                              </button>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr>
                              <td colSpan="6" style={{ padding: '0', background: 'rgba(255, 255, 255, 0.03)' }}>
                                <div style={{ padding: '20px 25px' }}>
                                  <h4 style={{ color: '#d4af37', margin: '0 0 12px 0', fontSize: '0.85rem', fontWeight: 700 }}>
                                    Referred Downlines ({user.downlines.length})
                                  </h4>
                                  {user.downlines.length === 0 ? (
                                    <p style={{ color: '#64748b', textAlign: 'center', padding: '15px 0', margin: 0 }}>
                                      No downline members yet.
                                    </p>
                                  ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                      <table className="admin-table" style={{ margin: 0 }}>
                                        <thead>
                                          <tr>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Code Used</th>
                                            <th>Date Used</th>
                                            <th>Status</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {user.downlines.map((down, idx) => (
                                            <tr key={`${down.id}-${idx}`}>
                                              <td style={{ fontWeight: 600 }}>{down.firstName} {down.lastName}</td>
                                              <td>{down.email || 'N/A'}</td>
                                              <td>
                                                <code style={{ color: '#d4af37', fontFamily: 'monospace', fontWeight: 600, fontSize: '0.75rem' }}>{down.usedCode}</code>
                                              </td>
                                              <td>{down.usedAt ? formatDate(down.usedAt) : 'N/A'}</td>
                                              <td>{statusLabel(down.referralStatus)}</td>
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

      {/* Referral Codes Modal */}
      {codesModalUser && (
        <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '60px', overflowY: 'auto' }} onClick={() => setCodesModalUser(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', margin: '0 auto' }}>
            <header className="modal-header" style={{ background: '#800020', flexShrink: 0 }}>
              <h3><FaKey style={{ marginRight: 8 }} /> Referral Codes — {codesModalUser.firstName} {codesModalUser.lastName}</h3>
              <button className="close-btn" onClick={() => setCodesModalUser(null)}>&times;</button>
            </header>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {(!codesModalUser.referralCodes || codesModalUser.referralCodes.length === 0) ? (
                <p style={{ textAlign: 'center', color: '#64748b', padding: '40px 20px' }}>No referral codes generated yet.</p>
              ) : (
                <table className="admin-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Plan</th>
                      <th>Status</th>
                      <th>Given To (Downline)</th>
                      <th>Date Used</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {codesModalUser.referralCodes.map((c, i) => (
                      <tr key={i}>
                        <td>
                          <code style={{ color: '#d4af37', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem' }}>{c.code}</code>
                        </td>
                        <td style={{ fontWeight: 600, textTransform: 'capitalize', fontSize: '0.85rem' }}>
                          {c.planName?.replace('_', ' ').toLowerCase() || 'N/A'}
                        </td>
                        <td>{statusBadge(c.status)}</td>
                        <td>
                          {c.usedBy ? (
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{c.usedBy}</div>
                              <div style={{ fontSize: '0.75rem', color: '#888' }}>{c.usedByEmail}</div>
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic' }}>Not yet used</span>
                          )}
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>{c.usedAt ? formatDateTime(c.usedAt) : '—'}</td>
                        <td style={{ fontSize: '0.85rem' }}>{formatDate(c.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReferrals;
