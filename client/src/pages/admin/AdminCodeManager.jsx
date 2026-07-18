import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  FaSearch, FaArrowLeft, FaKey, FaUserFriends, FaCheckCircle,
  FaTimesCircle, FaLock, FaExchangeAlt, FaChevronLeft, FaChevronRight,
  FaUsers, FaShieldAlt, FaUserCircle
} from 'react-icons/fa';
import API from '../../services/api';
import './Admin.css';

const PAGE_SIZE = 20;

const AdminCodeManager = () => {
  const [view, setView] = useState('list');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [codes, setCodes] = useState([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codeFilter, setCodeFilter] = useState('all');
  const [codesSearch, setCodesSearch] = useState('');
  const [assignModal, setAssignModal] = useState(null);
  const [targetSearch, setTargetSearch] = useState('');
  const [targetResults, setTargetResults] = useState([]);
  const [targetLoading, setTargetLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data } = await API.get('/admin/users');
      setUsers(data);
      setError('');
    } catch (err) {
      setError('Failed to load users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    if (!term) return users;
    return users.filter(u =>
      `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase().includes(term) ||
      (u.email && u.email.toLowerCase().includes(term)) ||
      (u.phone && u.phone.includes(searchTerm)) ||
      (u.referral_code && u.referral_code.toLowerCase().includes(term))
    );
  }, [users, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const displayUsers = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, safePage]);

  const fetchUserCodes = useCallback(async (userId, status) => {
    try {
      setCodesLoading(true);
      const params = status && status !== 'all' ? `?status=${status}` : '';
      const { data } = await API.get(`/admin/codes/users/${userId}${params}`);
      setSelectedUser(data.user);
      setCodes(data.codes);
      setView('detail');
    } catch (err) {
      toast.error('Failed to load user codes');
      console.error(err);
    } finally {
      setCodesLoading(false);
    }
  }, []);

  const handleSelectUser = (user) => {
    fetchUserCodes(user.id, codeFilter);
    setCodesSearch('');
  };

  const handleFilterChange = (newFilter) => {
    setCodeFilter(newFilter);
    if (selectedUser) fetchUserCodes(selectedUser.id, newFilter);
  };

  const handleBack = () => {
    setView('list');
    setSelectedUser(null);
    setCodes([]);
    setCodeFilter('all');
    setCodesSearch('');
  };

  const searchTargets = async (term) => {
    setTargetSearch(term);
    if (term.length < 2) { setTargetResults([]); return; }
    setTargetLoading(true);
    try {
      const { data } = await API.get('/admin/users');
      const t = term.toLowerCase();
      const matches = data.filter(u =>
        `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase().includes(t) ||
        (u.email && u.email.toLowerCase().includes(t)) ||
        (u.phone && u.phone.includes(term))
      ).slice(0, 10);
      setTargetResults(matches);
    } catch { setTargetResults([]); }
    setTargetLoading(false);
  };

  const handleAssign = async (targetUserId) => {
    if (!assignModal) return;
    setActionLoading(true);
    try {
      const endpoint = assignModal.type === 'assign'
        ? `/admin/referral-codes/${assignModal.codeId}/assign`
        : `/admin/referral-codes/${assignModal.codeId}/reassign`;
      const method = assignModal.type === 'assign' ? 'post' : 'put';
      await API[method](endpoint, { targetUserId });
      toast.success(assignModal.type === 'assign' ? 'Code assigned successfully' : 'Code reassigned successfully');
      setAssignModal(null);
      setTargetResults([]);
      setTargetSearch('');
      fetchUserCodes(selectedUser.id, codeFilter);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredCodes = useMemo(() => {
    const term = codesSearch.toLowerCase();
    if (!term) return codes;
    return codes.filter(c =>
      c.code.toLowerCase().includes(term) ||
      (c.used_by_name && `${c.used_by_name} ${c.used_by_last_name || ''}`.toLowerCase().includes(term)) ||
      (c.used_by_email && c.used_by_email.toLowerCase().includes(term)) ||
      (c.plan_name && c.plan_name.toLowerCase().includes(term))
    );
  }, [codes, codesSearch]);

  const formatDate = (d) => {
    if (!d) return 'N/A';
    const dt = new Date(d);
    if (isNaN(dt)) return 'N/A';
    return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateTime = (d) => {
    if (!d) return 'N/A';
    const dt = new Date(d);
    if (isNaN(dt)) return 'N/A';
    return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const statusBadge = (status) => {
    const s = {
      available: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', icon: <FaCheckCircle size={10} />, label: 'Available' },
      locked: { bg: '#fffbeb', color: '#d97706', border: '#fde68a', icon: <FaLock size={10} />, label: 'Locked' },
      used: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', icon: <FaTimesCircle size={10} />, label: 'Used' },
    }[status] || { bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0', icon: null, label: status };
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

  const goToPage = (p) => { if (p >= 1 && p <= totalPages) setPage(p); };

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, safePage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);

    pages.push(
      <button key="prev" className="btn btn-sm" style={{ margin: '0 2px' }}
        disabled={safePage === 1} onClick={() => goToPage(safePage - 1)}>
        <FaChevronLeft size={10} />
      </button>
    );
    for (let i = start; i <= end; i++) {
      pages.push(
        <button key={i} className={`btn btn-sm ${i === safePage ? 'btn-primary' : ''}`}
          style={{ margin: '0 2px', minWidth: '32px' }} onClick={() => goToPage(i)}>{i}</button>
      );
    }
    pages.push(
      <button key="next" className="btn btn-sm" style={{ margin: '0 2px' }}
        disabled={safePage === totalPages} onClick={() => goToPage(safePage + 1)}>
        <FaChevronRight size={10} />
      </button>
    );
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', padding: '16px 0' }}>
        {pages}
        <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '12px' }}>
          Page {safePage} of {totalPages} ({filteredUsers.length} users)
        </span>
      </div>
    );
  };

  if (view === 'detail' && codesLoading) {
    return (
      <div className="admin-page-content">
        <div className="admin-card table-card" style={{ padding: '60px 0', textAlign: 'center' }}>
          <div className="table-loader"><div className="spinner-small"></div><span>Loading codes...</span></div>
        </div>
      </div>
    );
  }

  if (view === 'detail' && selectedUser) {
    const availableCount = codes.filter(c => c.status === 'available').length;
    const usedCount = codes.filter(c => c.status === 'used').length;
    const lockedCount = codes.filter(c => c.status === 'locked').length;

    return (
      <div className="admin-page-content">
        <header className="dashboard-header">
          <div className="header-title">
            <button onClick={handleBack} className="btn btn-sm" style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '8px 12px', cursor: 'pointer', borderRadius: '8px' }}>
              <FaArrowLeft size={14} />
            </button>
            <div className="header-icon"><FaKey /></div>
            <div>
              <h2>{selectedUser.first_name} {selectedUser.last_name}</h2>
              <p className="text-muted">{selectedUser.email} | Codes: {codes.length}</p>
            </div>
          </div>
          <div className="header-actions">
            <div className="search-box">
              <FaSearch className="search-icon" />
              <input type="text" placeholder="Search codes..." value={codesSearch}
                onChange={(e) => setCodesSearch(e.target.value)} className="refined-input" />
            </div>
          </div>
        </header>

        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 25 }}>
          {[
            { label: 'All', count: codes.length, color: '#64748b', filter: 'all' },
            { label: 'Available', count: availableCount, color: '#16a34a', filter: 'available' },
            { label: 'Used', count: usedCount, color: '#dc2626', filter: 'used' },
            { label: 'Locked', count: lockedCount, color: '#d97706', filter: 'locked' },
          ].map(s => (
            <div key={s.filter} className="stat-card" onClick={() => handleFilterChange(s.filter)}
              style={{ cursor: 'pointer', border: codeFilter === s.filter ? `2px solid ${s.color}` : '2px solid transparent' }}>
              <div className="stat-info" style={{ textAlign: 'center', padding: '12px' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color }}>{s.count}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="admin-card table-card">
          {filteredCodes.length === 0 ? (
            <div className="table-empty">
              <div className="empty-icon"><FaKey size={32} /></div>
              <h3>No Codes Found</h3>
              <p>{codesSearch ? 'No matching codes.' : 'No codes for this status.'}</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Assigned To</th>
                    <th>Email</th>
                    <th>Date Used</th>
                    <th>Created</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCodes.map(c => (
                    <tr key={c.id}>
                      <td>
                        <code style={{ color: '#d4af37', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem' }}>{c.code}</code>
                      </td>
                      <td style={{ fontWeight: 600, textTransform: 'capitalize', fontSize: '0.85rem' }}>
                        {c.plan_name?.replace('_', ' ').toLowerCase() || 'N/A'}
                      </td>
                      <td>{statusBadge(c.status)}</td>
                      <td>
                        {c.used_by_name ? (
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{c.used_by_name} {c.used_by_last_name || ''}</div>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{c.used_by_email || '—'}</td>
                      <td style={{ fontSize: '0.85rem' }}>{c.used_at ? formatDateTime(c.used_at) : '—'}</td>
                      <td style={{ fontSize: '0.85rem' }}>{formatDate(c.created_at)}</td>
                      <td className="text-right">
                        {c.status === 'available' ? (
                          <button className="btn btn-sm" onClick={() => setAssignModal({ codeId: c.id, code: c.code, type: 'assign' })}
                            style={{ padding: '5px 12px', fontSize: '0.75rem', background: '#800020', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <FaUserFriends size={10} /> Assign
                          </button>
                        ) : c.status === 'used' ? (
                          <button className="btn btn-sm" onClick={() => setAssignModal({ codeId: c.id, code: c.code, type: 'reassign' })}
                            style={{ padding: '5px 12px', fontSize: '0.75rem', background: '#d4af37', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <FaExchangeAlt size={10} /> Reassign
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Assign / Reassign Modal */}
        {assignModal && (
          <div className="modal-overlay" onClick={() => { setAssignModal(null); setTargetResults([]); setTargetSearch(''); }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', margin: 'auto' }}>
              <header className="modal-header" style={{ background: '#800020', flexShrink: 0 }}>
                <h3>
                  {assignModal.type === 'assign' ? <><FaUserFriends style={{ marginRight: 8 }} /> Assign Code</> : <><FaExchangeAlt style={{ marginRight: 8 }} /> Reassign Code</>}
                  {' '}<code style={{ fontFamily: 'monospace' }}>{assignModal.code}</code>
                </h3>
                <button className="close-btn" onClick={() => { setAssignModal(null); setTargetResults([]); setTargetSearch(''); }}>&times;</button>
              </header>
              <div style={{ padding: '20px', overflowY: 'auto', maxHeight: '60vh' }}>
                <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '16px' }}>
                  {assignModal.type === 'assign'
                    ? 'Search for the user to assign this code to. They will become a downline of the code owner.'
                    : 'Search for the user to reassign this code to. The current downline will be replaced.'}
                </p>
                <div className="search-box" style={{ width: '100%', marginBottom: '16px' }}>
                  <FaSearch className="search-icon" />
                  <input type="text" placeholder="Search by name, email, or phone..." value={targetSearch}
                    onChange={(e) => searchTargets(e.target.value)} className="refined-input" />
                </div>
                {targetLoading && <p style={{ textAlign: 'center', color: '#94a3b8' }}>Searching...</p>}
                {targetResults.length > 0 && (
                  <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    {targetResults.map(u => (
                      <div key={u.id} onClick={() => handleAssign(u.id)}
                        style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div className="member-avatar" style={{ background: '#800020', width: '36px', height: '36px', fontSize: '0.75rem', flexShrink: 0 }}>
                          {(u.first_name?.[0] || 'U')}{(u.last_name?.[0] || '')}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{u.first_name} {u.last_name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{u.email || 'No email'} {u.phone ? `| ${u.phone}` : ''}</div>
                        </div>
                        {actionLoading && <div className="spinner-small" style={{ width: 20, height: 20 }}></div>}
                      </div>
                    ))}
                  </div>
                )}
                {!targetLoading && targetSearch.length >= 2 && targetResults.length === 0 && (
                  <p style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>No users found for "{targetSearch}"</p>
                )}
                {targetSearch.length < 2 && (
                  <p style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>Type at least 2 characters to search</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="admin-page-content">
      <header className="dashboard-header">
        <div className="header-title">
          <div className="header-icon"><FaKey /></div>
          <div>
            <h2>Code Manager</h2>
            <p className="text-muted">Select a user to manage their referral codes</p>
          </div>
        </div>
        <div className="header-actions">
          <div className="search-box">
            <FaSearch className="search-icon" />
            <input type="text" placeholder="Search by name, email, or code..." value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }} className="refined-input" />
          </div>
        </div>
      </header>

      {loading ? (
        <div className="admin-card table-card" style={{ padding: '60px 0', textAlign: 'center' }}>
          <div className="table-loader"><div className="spinner-small"></div><span>Loading users...</span></div>
        </div>
      ) : error ? (
        <div className="admin-card table-card" style={{ padding: '60px 0', textAlign: 'center' }}>
          <div className="table-empty">
            <FaShieldAlt size={40} style={{ color: '#ef4444' }} />
            <h3>Failed to Load</h3>
            <p style={{ maxWidth: 400, margin: '0 auto' }}>{error}</p>
            <button className="btn btn-primary" onClick={fetchUsers} style={{ marginTop: 15 }}>Retry</button>
          </div>
        </div>
      ) : (
        <div className="admin-card table-card">
          {displayUsers.length === 0 ? (
            <div className="table-empty">
              <div className="empty-icon"><FaUsers size={32} /></div>
              <h3>No Users Found</h3>
              <p>{searchTerm ? 'No matches for your search.' : 'No users available.'}</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Contact</th>
                    <th><FaLink size={11} /> Referral Code</th>
                    <th className="text-right">Downlines</th>
                    <th>Joined</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayUsers.map(u => (
                    <tr key={u.id} className="table-row-hover">
                      <td>
                        <div className="member-cell">
                          <div className="member-avatar" style={{ background: '#800020', width: '32px', height: '32px', fontSize: '0.75rem' }}>
                            {(u.first_name?.[0] || 'U')}{(u.last_name?.[0] || '')}
                          </div>
                          <div className="member-info">
                            <span className="member-name">{u.first_name || 'Unknown'} {u.last_name || ''}</span>
                            <span className="member-id">{u.role?.toUpperCase()}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="contact-info">
                          <div className="contact-item" style={{ fontSize: '0.8rem' }}>
                            <FaUserCircle size={12} /> {u.email || 'No email'}
                          </div>
                          <div className="contact-item" style={{ fontSize: '0.8rem' }}>
                            {u.phone || 'N/A'}
                          </div>
                        </div>
                      </td>
                      <td>
                        <code style={{ color: '#d4af37', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem' }}>
                          {u.referral_code || 'N/A'}
                        </code>
                      </td>
                      <td className="text-right" style={{ fontWeight: 700, fontSize: '1rem', color: '#d4af37' }}>
                        {u.downline_count || 0}
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{formatDate(u.created_at)}</td>
                      <td className="text-right">
                        <button className="btn btn-sm" onClick={() => handleSelectUser(u)}
                          style={{ padding: '5px 12px', fontSize: '0.75rem', background: '#800020', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <FaKey size={10} /> Manage Codes
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {renderPagination()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminCodeManager;
