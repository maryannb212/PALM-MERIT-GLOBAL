import React, { useState, useEffect } from 'react';
import { getDefaulters, updateDefault, resolveUserDefaults } from '../../services/api';
import UserDefaultsModal from './UserDefaultsModal';
import { FaUserTimes, FaExclamationTriangle, FaGavel, FaEnvelope, FaCalendarTimes, FaUser, FaCheckCircle, FaEye, FaMoneyBillWave, FaSearch, FaTimes, FaSync } from 'react-icons/fa';
import '../dashboard/Dashboard.css';
import './Admin.css';

const DefaultersPage = () => {
  const [defaulters, setDefaulters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalUser, setModalUser] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);

  useEffect(() => {
    fetchDefaulters();
  }, []);

  const fetchDefaulters = async () => {
    try {
      setLoading(true);
      const { data } = await getDefaulters();
      setDefaulters(data);
    } catch (error) {
      console.error('Error fetching defaulters:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = defaulters.filter(d => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      d.first_name?.toLowerCase().includes(q) ||
      d.last_name?.toLowerCase().includes(q) ||
      d.email?.toLowerCase().includes(q) ||
      d.plan_name?.toLowerCase().includes(q)
    );
  });

  const totalOutstanding = filtered.reduce((s, d) => s + parseFloat(d.penalty_amount || 0), 0);
  const uniqueUsers = [...new Set(filtered.map(d => d.user_id))].length;

  const handleQuickClear = async (defaultId, userId, userName) => {
    if (!window.confirm(`Clear this default for ${userName}?`)) return;
    try {
      await updateDefault(defaultId, { resolved: true });
      setActionMsg({ type: 'success', text: `Default cleared for ${userName}` });
      fetchDefaulters();
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.message || 'Failed to clear default' });
    }
    setTimeout(() => setActionMsg(null), 4000);
  };

  const handleClearUserDefaults = async (userId, userName) => {
    if (!window.confirm(`Clear ALL outstanding defaults for ${userName}?`)) return;
    try {
      await resolveUserDefaults(userId);
      setActionMsg({ type: 'success', text: `All defaults cleared for ${userName}` });
      fetchDefaulters();
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.message || 'Failed to clear defaults' });
    }
    setTimeout(() => setActionMsg(null), 4000);
  };

  const handleOpenModal = (userId, userName) => {
    setModalUser({ userId, userName });
  };

  return (
    <div className="admin-page-content">
      <header className="dashboard-header">
        <div className="header-title">
          <div className="header-icon"><FaGavel /></div>
          <div>
            <h2>Defaulter Management</h2>
            <p className="text-muted">Monitor, edit, and resolve member defaults across all programs.</p>
          </div>
        </div>
        {(actionMsg) => (
          <div style={{
            position: 'fixed', top: 20, right: 20, zIndex: 9999,
            padding: '12px 20px', borderRadius: 8,
            background: actionMsg?.type === 'success' ? '#d1fae5' : '#fef2f2',
            border: `1px solid ${actionMsg?.type === 'success' ? '#6ee7b7' : '#fecaca'}`,
            color: actionMsg?.type === 'success' ? '#065f46' : '#991b1b',
            display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.9rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            {actionMsg?.type === 'success' ? <FaCheckCircle /> : <FaExclamationTriangle />}
            {actionMsg?.text}
            <button onClick={() => setActionMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 8, opacity: 0.6 }}>
              <FaTimes />
            </button>
          </div>
        )}
      </header>

      {/* ─── Stats Cards ─── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 20 }}>
        <div className="stat-card" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
          <div className="stat-icon" style={{ background: '#fee2e2', color: '#dc2626' }}><FaUserTimes /></div>
          <h3 style={{ color: '#991b1b', fontSize: '0.8rem' }}>Total Unresolved</h3>
          <div className="stat-count" style={{ color: '#dc2626', fontWeight: 700 }}>{filtered.length}</div>
        </div>
        <div className="stat-card" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
          <div className="stat-icon" style={{ background: '#ffedd5', color: '#ea580c' }}><FaMoneyBillWave /></div>
          <h3 style={{ color: '#9a3412', fontSize: '0.8rem' }}>Total Outstanding</h3>
          <div className="stat-count" style={{ color: '#ea580c', fontWeight: 700 }}>₦{totalOutstanding.toLocaleString()}</div>
        </div>
        <div className="stat-card" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <div className="stat-icon" style={{ background: '#dbeafe', color: '#2563eb' }}><FaUser /></div>
          <h3 style={{ color: '#1e40af', fontSize: '0.8rem' }}>Affected Members</h3>
          <div className="stat-count" style={{ color: '#2563eb', fontWeight: 700 }}>{uniqueUsers}</div>
        </div>
      </div>

      {/* ─── Table ─── */}
      <div className="admin-card table-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h4 style={{ margin: 0, fontSize: '1rem' }}>Default Records</h4>
            <span style={{ background: '#e2e8f0', padding: '2px 10px', borderRadius: 20, fontSize: '0.8rem', color: '#475569' }}>{filtered.length} records</span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <FaSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 12 }} />
              <input
                type="text"
                placeholder="Search member or plan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ padding: '8px 12px 8px 30px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem', width: 220, outline: 'none' }}
              />
            </div>
            <button className="btn btn-sm" onClick={fetchDefaulters} style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <FaSync />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="table-loader">
            <div className="spinner-small"></div>
            <span>Fetching delinquency records...</span>
          </div>
        ) : defaulters.length === 0 ? (
          <div className="table-empty">
            <div className="empty-icon">✅</div>
            <h3>No Active Defaulters</h3>
            <p>Excellent! All community members are currently up to date with their contributions.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="table-empty">
            <div className="empty-icon">🔍</div>
            <h3>No Results</h3>
            <p>No default records match your search criteria.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th><FaUser /> Member</th>
                  <th>Subscription Plan</th>
                  <th><FaCalendarTimes /> Missed Date</th>
                  <th>Penalty Amount</th>
                  <th>Resolve</th>
                  <th className="text-right" style={{ minWidth: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} className="table-row-hover">
                    <td>
                      <div className="member-cell">
                        <div className="member-avatar" style={{ background: '#f59e0b' }}>
                          {d.first_name?.[0]}{d.last_name?.[0]}
                        </div>
                        <div className="member-info">
                          <span className="member-name">{d.first_name} {d.last_name}</span>
                          <span className="member-id"><FaEnvelope size={10} /> {d.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge-pill pill-dark">{d.plan_name?.replace('_', ' ')}</span>
                    </td>
                    <td className="date-cell">
                      {new Date(d.missed_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td>
                      <div className="penalty-value" style={{ fontWeight: 700, color: '#dc2626' }}>
                        ₦{parseFloat(d.penalty_amount).toLocaleString()}
                      </div>
                    </td>
                    <td>
                      <span className="badge-status status-unverified">
                        <FaExclamationTriangle size={10} /> UNRESOLVED
                      </span>
                    </td>
                    <td className="text-right">
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-sm"
                          onClick={() => handleOpenModal(d.user_id, `${d.first_name} ${d.last_name}`)}
                          title="View & Manage Defaults"
                          style={{ padding: '6px 12px', fontSize: 12, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <FaEye /> Manage
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => handleQuickClear(d.id, d.user_id, `${d.first_name} ${d.last_name}`)}
                          title="Quick Clear This Default"
                          style={{ padding: '6px 12px', fontSize: 12, background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <FaCheckCircle /> Clear
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => handleClearUserDefaults(d.user_id, `${d.first_name} ${d.last_name}`)}
                          title="Clear All Defaults for This Member"
                          style={{ padding: '6px 12px', fontSize: 12, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <FaTimes /> Clear All
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

      {modalUser && (
        <UserDefaultsModal
          isOpen={true}
          onClose={() => { setModalUser(null); fetchDefaulters(); }}
          userId={modalUser.userId}
          userName={modalUser.userName}
        />
      )}
    </div>
  );
};

export default DefaultersPage;
